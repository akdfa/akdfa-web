const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const env = require("./config/env");
const apiRoutes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(
  helmet({
    // Allow the uploaded images/PDFs to be embedded by the frontend on another origin.
    crossOriginResourcePolicy: { policy: "cross-origin" },
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
  rateLimit({ windowMs: 15 * 60 * 1000, max: 40, message: { error: { message: "Too many attempts, try again later" } } })
);

app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

app.use("/api/v1", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
