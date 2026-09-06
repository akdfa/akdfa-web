const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// ─────────────────────────────────────────────────────────────
// Environment file loading.
//
//   NODE_ENV=development  → loads .env.development, then .env
//   NODE_ENV=production   → loads .env.production,  then .env
//   (unset)               → treated as "development"
//
// Earlier files win (dotenv does not override already-set vars), and real
// process env (e.g. from the host / CI) beats every file. So the pattern is:
//   - commit .env.development (safe local defaults) and .env.production (a
//     template with blanks + comments)
//   - put anything secret in .env (git-ignored) or the host's own env
// ─────────────────────────────────────────────────────────────
const NODE_ENV = process.env.NODE_ENV || "development";
const backendRoot = path.resolve(__dirname, "..", "..");
// Highest precedence first; dotenv does not override an already-set var, and the
// real process environment (host / CI) beats every file.
const loaded = [];
for (const file of [`.env.${NODE_ENV}.local`, ".env.local", `.env.${NODE_ENV}`, ".env"]) {
  const full = path.join(backendRoot, file);
  if (fs.existsSync(full)) {
    dotenv.config({ path: full });
    loaded.push(file);
  }
}
if (process.env.AKDFA_ENV_DEBUG) {
  console.log(`[akdfa] NODE_ENV=${NODE_ENV} · env files: ${loaded.join(", ") || "(none)"}`); // eslint-disable-line no-console
}

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name} (set it in .env.${NODE_ENV} or .env)`);
  }
  return value;
}

const isProd = NODE_ENV === "production";

// Field-encryption key. 64 hex chars. A dev fallback keeps local work unblocked
// but is refused in production — rotating it orphans every ciphertext.
const DEV_ENC_KEY = "0".repeat(64);
if (!process.env.ENCRYPTION_KEY) {
  if (isProd) throw new Error("ENCRYPTION_KEY is required in production");
  console.warn("[akdfa] ENCRYPTION_KEY is not set — using an INSECURE dev key. Set one before storing real data."); // eslint-disable-line no-console
} else if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)) {
  throw new Error("ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)");
}

if (isProd) {
  for (const k of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "DATABASE_URL"]) {
    if (!process.env[k]) throw new Error(`${k} is required in production`);
  }
  if ((process.env.UPLOAD_DRIVER || "local") === "s3" && !process.env.S3_BUCKET) {
    throw new Error("UPLOAD_DRIVER=s3 needs S3_BUCKET");
  }
  if ((process.env.MAIL_DRIVER || "log") === "smtp" && !process.env.SMTP_HOST) {
    throw new Error("MAIL_DRIVER=smtp needs SMTP_HOST");
  }
}

// CORS_ORIGIN may be "*", a single origin, or a comma-separated list.
const rawCors = process.env.CORS_ORIGIN || "*";
const corsOrigin =
  rawCors.trim() === "*"
    ? "*"
    : rawCors
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

module.exports = {
  nodeEnv: NODE_ENV,
  isProd,
  port: Number(process.env.PORT || 4000),
  encryptionKey: process.env.ENCRYPTION_KEY || DEV_ENC_KEY,
  corsOrigin,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`,
  // Where the browser frontend is served — used to build reset / verify links.
  siteBaseUrl: process.env.SITE_BASE_URL || process.env.PUBLIC_BASE_URL || "http://localhost:5500",
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET", isProd ? undefined : "dev-access-secret"),
    refreshSecret: required("JWT_REFRESH_SECRET", isProd ? undefined : "dev-refresh-secret"),
    accessTtl: process.env.JWT_ACCESS_TTL || "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL || "30d",
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  },
  uploads: {
    driver: process.env.UPLOAD_DRIVER || "local", // "local" | "s3"
    dir: process.env.UPLOAD_DIR || "uploads",
  },
  s3: {
    bucket: process.env.S3_BUCKET || "",
    region: process.env.S3_REGION || "ap-south-1",
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    endpoint: process.env.S3_ENDPOINT || "", // set for MinIO / R2 / other S3-compatible
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || "", // CDN / bucket URL for public files
  },
  mail: {
    driver: process.env.MAIL_DRIVER || "log", // "log" | "smtp"
    from: process.env.MAIL_FROM || "AKDFA <no-reply@akdfa.org>",
    smtp: {
      host: process.env.SMTP_HOST || "",
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  },
  bootstrapAdmin: {
    email: process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@akdfa.org",
    phone: process.env.BOOTSTRAP_ADMIN_PHONE || "+919000000000",
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || "akdfa-admin-2026",
  },
};
