const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const env = require("./config/env");
const apiRoutes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const requestContext = require("./utils/requestContext");

const app = express();

if (env.trustProxy) app.set("trust proxy", env.trustProxy);

// When this server also serves the website, allow exactly what the pages load:
// inline page scripts, cdnjs (Font Awesome, QR), Google Fonts, Razorpay checkout.
const siteCsp = {
  useDefaults: true,
  directives: {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://checkout.razorpay.com"],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "connect-src": ["'self'", "https://*.razorpay.com"],
    "frame-src": ["https://api.razorpay.com", "https://checkout.razorpay.com"],
    "object-src": ["'none'"],
    "upgrade-insecure-requests": env.publicBaseUrl.startsWith("https:") ? [] : null,
  },
};

app.use(
  helmet({
    // Allow the uploaded images/PDFs to be embedded by the frontend on another origin.
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Pure JSON API → helmet's strict default CSP; site-serving mode → the tailored one.
    contentSecurityPolicy: env.serveSite ? siteCsp : undefined,
  })
);

// cors() accepts "*" (reflected), a string, or an array of allowed origins.
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  })
);

// Stash the raw body so the Razorpay webhook can verify the HMAC signature
// against exactly what was sent, not a re-serialized copy.
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(requestContext.middleware); // lets the audit log record the caller's IP
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Locally-stored uploads (profile photos, documents, product images).
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), env.uploads.dir), {
    fallthrough: false,
    maxAge: "7d",
  })
);

// Generous global ceiling — auth routes get a tighter limit below to slow credential stuffing.
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1200 }));
app.use(
  "/api/v1/auth",
  rateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.AUTH_RATE_LIMIT_MAX || 40), message: { error: { message: "Too many attempts, try again later" } } })
);

app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

// Landing page for anyone who opens the API address in a browser
// (skipped when this server serves the website itself).
if (!env.serveSite) {
  app.get("/", (req, res) => {
    const site = env.siteBaseUrl.replace(/\/$/, "");
    res.type("html").send(`<!doctype html><meta charset="utf-8"><title>AKDFA API</title>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:0 20px;line-height:1.6;color:#222">
<h1 style="margin-bottom:4px">AKDFA API</h1>
<p style="margin-top:0;color:#666">Backend for the AKDFA website and member portal. This address serves data, not pages.</p>
<ul>
  <li><a href="${site}">Open the website</a> &nbsp;·&nbsp; <a href="${site}/login.html">Member / committee sign-in</a></li>
  <li><a href="/health">/health</a> — service status</li>
  <li><a href="/api/v1">/api/v1</a> — API index</li>
</ul></body>`);
  });
}

app.get("/api/v1", (req, res) =>
  res.json({
    name: "AKDFA API",
    version: "1",
    status: "ok",
    docs: "docs/api/API_REFERENCE.md",
    modules: ["auth", "districts", "units", "members", "news", "events", "polls", "cricket", "sponsors", "social", "growth", "notifications", "reports", "admin", "payments", "store", "feedback", "uploads", "public"],
  })
);

app.use("/api/v1", apiRoutes);

// One-service hosting: serve the website from the repo root — but ONLY an explicit
// allowlist (top-level pages/assets, js/, css/, assets/). Never backend/, .env,
// docs/, or anything else in the repo.
if (env.serveSite) {
  const siteRoot = path.resolve(__dirname, "..", "..");
  const FILE = /^\/(?:(?:assets|js|css)\/[\w./ %()-]+|[\w-]+\.(?:html|css|js|png|jpe?g|svg|ico|webp|webmanifest))$/i;
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    let p = req.path === "/" ? "/index.html" : req.path;
    if (/^\/[\w-]+$/.test(p)) p += ".html"; // /login → /login.html
    if (p.includes("..") || !FILE.test(p)) return next();
    res.sendFile(p.slice(1), { root: siteRoot, dotfiles: "deny", maxAge: p.endsWith(".html") ? 0 : "1h" }, (err) => err && next());
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
