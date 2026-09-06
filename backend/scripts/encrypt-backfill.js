/* eslint-disable no-console */
// One-time backfill: encrypt PII in rows that were written before field
// encryption was enabled (or imported from elsewhere as plaintext).
//
// Safe to run repeatedly — encrypt() is idempotent and rows already in the
// `v1:` envelope are skipped. Run AFTER `prisma migrate deploy` has added the
// emailHash / phoneHash columns.
//
//   node scripts/encrypt-backfill.js
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { encrypt, blindIndex, isEncrypted } = require("../src/utils/crypto");

// Raw client WITHOUT the encryption middleware, so we control exactly what is written.
const prisma = new PrismaClient();

async function backfillModel(name, delegate, fields, blind) {
  const rows = await delegate.findMany();
  let touched = 0;
  for (const row of rows) {
    const data = {};
    for (const f of fields) {
      if (typeof row[f] === "string" && !isEncrypted(row[f])) data[f] = encrypt(row[f]);
    }
    for (const [plainField, hashField] of Object.entries(blind || {})) {
      // derive the hash from the *plaintext* still on the row
      if (typeof row[plainField] === "string" && !isEncrypted(row[plainField]) && !row[hashField]) {
        data[hashField] = blindIndex(row[plainField]);
      }
    }
    if (Object.keys(data).length) {
      await delegate.update({ where: { id: row.id }, data });
      touched++;
    }
  }
  console.log(`  ${name}: ${touched}/${rows.length} rows updated`);
}

(async () => {
  console.log("Encrypting existing PII…");
  await backfillModel("Member", prisma.member, ["email", "phone", "dateOfBirth"], { email: "emailHash", phone: "phoneHash" });
  await backfillModel("Unit", prisma.unit, ["address", "contactEmail", "contactPhone"]);
  await backfillModel("Sponsor", prisma.sponsor, ["contactName", "contactEmail", "contactPhone"]);
  await backfillModel("SponsorshipLog", prisma.sponsorshipLog, ["sponsorName", "notes"]);
  await backfillModel("Document", prisma.document, ["fileKey"]);
  await backfillModel("NewsletterSubscriber", prisma.newsletterSubscriber, ["email"], { email: "emailHash" });
  await backfillModel("ContactMessage", prisma.contactMessage, ["email", "phone", "message"]);
  await backfillModel("Feedback", prisma.feedback, ["message", "response"]);
  console.log("Done.");
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
