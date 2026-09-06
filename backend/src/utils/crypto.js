// Application-level field encryption for personally identifiable data.
//
//   - AES-256-GCM, authenticated, random 96-bit IV per value.
//   - Stored format:  v1:<iv b64>:<authTag b64>:<ciphertext b64>
//   - blindIndex() produces a keyed, deterministic HMAC so an encrypted column
//     (email, phone) can still be looked up by exact value without a plaintext copy.
//
// The key comes from ENCRYPTION_KEY (64 hex chars = 32 bytes). Changing the key
// makes existing ciphertext unreadable — treat it like the database itself.
const crypto = require("crypto");
const env = require("../config/env");

const PREFIX = "v1:";
const KEY = Buffer.from(env.encryptionKey, "hex");

if (KEY.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
}

function encrypt(plain) {
  if (plain === null || plain === undefined || plain === "") return plain;
  const s = String(plain);
  if (s.startsWith(PREFIX)) return s; // already encrypted — idempotent
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(s, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + iv.toString("base64") + ":" + tag.toString("base64") + ":" + enc.toString("base64");
}

function decrypt(payload) {
  if (payload === null || payload === undefined) return payload;
  const s = String(payload);
  if (!s.startsWith(PREFIX)) return payload; // plaintext or legacy row — leave as-is
  try {
    const [, ivB64, tagB64, dataB64] = s.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch (err) {
    return payload; // wrong key / tampered — fail closed to the raw value rather than throwing mid-query
  }
}

// Deterministic keyed hash for equality lookups on an encrypted column.
function blindIndex(value) {
  if (value === null || value === undefined || value === "") return value;
  const normalized = String(value).trim().toLowerCase();
  return crypto.createHmac("sha256", KEY).update("bi:" + normalized).digest("hex");
}

function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

// Short keyed tag printed on the digital card's QR so a gate check can confirm
// the card wasn't hand-typed. Not a secret — just unforgeable without the key.
function cardVerifyToken(memberNumber) {
  return crypto.createHmac("sha256", KEY).update("card:" + memberNumber).digest("hex").slice(0, 16);
}

module.exports = { encrypt, decrypt, blindIndex, isEncrypted, cardVerifyToken };
