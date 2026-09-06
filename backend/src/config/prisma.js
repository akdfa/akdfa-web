const { PrismaClient } = require("@prisma/client");
const { encrypt, decrypt, blindIndex } = require("../utils/crypto");

// Single shared Prisma client for the whole process — avoid instantiating
// per-request, Prisma pools connections internally.
const prisma = new PrismaClient();

/* ------------------------------------------------------------------ *
 * Transparent field-level encryption.
 *
 * Writes: listed fields on these models are encrypted before they hit
 * Postgres; where a `blind` mapping exists, a keyed hash of the plaintext
 * is written to the companion column so exact-match lookups still work
 * (query those columns directly, e.g. `where: { emailHash }`).
 *
 * Reads: any field named in DECRYPT_KEYS is run back through decrypt(),
 * recursively through included relations. decrypt() is a no-op on values
 * that aren't in the `v1:` envelope, so plaintext/legacy rows are safe.
 * ------------------------------------------------------------------ */
const ENCRYPTED = {
  Member: { fields: ["email", "phone", "dateOfBirth"], blind: { email: "emailHash", phone: "phoneHash" } },
  Unit: { fields: ["address", "contactEmail", "contactPhone"], blind: {} },
  Sponsor: { fields: ["contactName", "contactEmail", "contactPhone"], blind: {} },
  SponsorshipLog: { fields: ["sponsorName", "notes"], blind: {} },
  Document: { fields: ["fileUrl"], blind: {} },
  NewsletterSubscriber: { fields: ["email"], blind: { email: "emailHash" } },
  ContactMessage: { fields: ["email", "phone", "message"], blind: {} },
};

const DECRYPT_KEYS = new Set(
  Object.values(ENCRYPTED).flatMap((c) => c.fields)
);

function applyWrite(model, obj) {
  if (!obj || typeof obj !== "object") return;
  const cfg = ENCRYPTED[model];
  if (!cfg) return;
  const one = (row) => {
    if (!row || typeof row !== "object") return;
    for (const [plainField, hashField] of Object.entries(cfg.blind)) {
      const v = row[plainField];
      if (typeof v === "string" && !v.startsWith("v1:")) row[hashField] = blindIndex(v);
    }
    for (const f of cfg.fields) {
      if (typeof row[f] === "string") row[f] = encrypt(row[f]);
    }
  };
  if (Array.isArray(obj)) obj.forEach(one);
  else one(obj);
}

function decryptDeep(node, depth) {
  if (!node || typeof node !== "object" || depth > 6) return node;
  if (Array.isArray(node)) {
    for (const item of node) decryptDeep(item, depth + 1);
    return node;
  }
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (typeof val === "string" && DECRYPT_KEYS.has(key)) node[key] = decrypt(val);
    else if (val && typeof val === "object") decryptDeep(val, depth + 1);
  }
  return node;
}

const WRITE_ACTIONS = new Set(["create", "update", "upsert", "createMany", "updateMany"]);
const RESULT_ACTIONS = new Set([
  "findUnique", "findFirst", "findMany", "findUniqueOrThrow", "findFirstOrThrow",
  "create", "update", "upsert", "delete",
]);

prisma.$use(async (params, next) => {
  if (WRITE_ACTIONS.has(params.action) && params.model && params.args) {
    if (params.action === "upsert") {
      applyWrite(params.model, params.args.create);
      applyWrite(params.model, params.args.update);
    } else {
      applyWrite(params.model, params.args.data);
    }
  }
  const result = await next(params);
  if (RESULT_ACTIONS.has(params.action)) decryptDeep(result, 0);
  return result;
});

module.exports = prisma;
