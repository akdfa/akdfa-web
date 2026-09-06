require("dotenv").config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

// Field-encryption key. 64 hex chars. A dev fallback keeps local work unblocked
// but must never be used with real data — rotating it orphans every ciphertext.
const DEV_ENC_KEY = "0".repeat(64);
if (!process.env.ENCRYPTION_KEY) {
  console.warn("[akdfa] ENCRYPTION_KEY is not set — using an INSECURE dev key. Set one before storing real data."); // eslint-disable-line no-console
} else if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)) {
  throw new Error("ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)");
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
  port: Number(process.env.PORT || 4000),
  encryptionKey: process.env.ENCRYPTION_KEY || DEV_ENC_KEY,
  corsOrigin,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`,
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret"),
    refreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
    accessTtl: process.env.JWT_ACCESS_TTL || "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL || "30d",
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  },
  uploads: {
    driver: process.env.UPLOAD_DRIVER || "local",
    dir: process.env.UPLOAD_DIR || "uploads",
  },
  bootstrapAdmin: {
    email: process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@akdfa.org",
    phone: process.env.BOOTSTRAP_ADMIN_PHONE || "+919000000000",
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || "akdfa-admin-2026",
  },
};
