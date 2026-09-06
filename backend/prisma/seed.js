// Seeds AKDFA reference data:
//   - 14 Kerala districts + 2 out-of-state + 1 ladies unit  = 17 units total
//   - the bootstrap State Committee account (from .env BOOTSTRAP_ADMIN_*)
//   - a starter set of badges and store products
//   - a couple of published news posts and calendar events so the app isn't empty
//
// Safe to re-run: everything is upserted.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("../src/config/prisma"); // shared client — carries the encryption middleware
const { blindIndex } = require("../src/utils/crypto");

const ADMIN = {
  email: process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@akdfa.org",
  phone: process.env.BOOTSTRAP_ADMIN_PHONE || "+919000000000",
  password: process.env.BOOTSTRAP_ADMIN_PASSWORD || "akdfa-admin-2026",
};

// district code -> { name, region, units: [{ name, contactPhone?, contactEmail? }] }
const DISTRICTS = [
  { code: "TVM", name: "Thiruvananthapuram", region: "South Kerala", units: [{ name: "Trivandrum Unit", contactPhone: "+917293497016" }] },
  { code: "KLM", name: "Kollam", region: "South Kerala", units: [{ name: "Kollam Unit", contactPhone: "+919946591833" }] },
  { code: "PTA", name: "Pathanamthitta", region: "Central Kerala", units: [{ name: "Pathanamthitta Unit", contactPhone: "+917559931705" }] },
  { code: "ALP", name: "Alappuzha", region: "Central Kerala", units: [{ name: "Alappuzha Unit", contactPhone: "+919037748560" }] },
  { code: "KTM", name: "Kottayam", region: "Central Kerala", units: [{ name: "Kottayam Unit", contactPhone: "+918111909967" }] },
  { code: "IDK", name: "Idukki", region: "High Range", units: [{ name: "Idukki Unit", contactPhone: "+917907984260" }] },
  { code: "EKM", name: "Ernakulam", region: "Central Kerala", units: [{ name: "Ernakulam Unit", contactPhone: "+919946110191" }] },
  { code: "TSR", name: "Thrissur", region: "Central Kerala", units: [{ name: "Thrissur Unit", contactPhone: "+916238626751" }] },
  { code: "PKD", name: "Palakkad", region: "Malabar", units: [{ name: "Palakkad Unit", contactPhone: "+918086379115" }] },
  { code: "MLP", name: "Malappuram", region: "Malabar", units: [{ name: "Malappuram Unit", contactPhone: "+918592841869" }] },
  { code: "KKD", name: "Kozhikode", region: "Malabar", units: [{ name: "Kozhikode Unit", contactPhone: "+919961125461" }] },
  { code: "WYD", name: "Wayanad", region: "Malabar", units: [{ name: "Wayanad Unit", contactPhone: "+918075201873" }] },
  { code: "KNR", name: "Kannur", region: "North Malabar", units: [{ name: "Kannur Unit", contactPhone: "+919562055270" }] },
  { code: "KSD", name: "Kasaragod", region: "North Malabar", units: [{ name: "Kasaragod Unit", contactPhone: "+917022407770" }] },
  { code: "CHN", name: "Chennai (Diaspora)", region: "Out of State", units: [{ name: "Chennai Unit" }] },
  { code: "BLR", name: "Bangalore (Diaspora)", region: "Out of State", units: [{ name: "Bangalore Unit" }] },
  { code: "LDS", name: "Ladies Wing", region: "Statewide", units: [{ name: "AKDFA Ladies Unit", contactEmail: "akdfagirlswing7@gmail.com" }] },
];

const BADGES = [
  { name: "Founding Member", description: "Joined AKDFA in its first digital year", criteria: "Registered in 2026" },
  { name: "Event Regular", description: "Showed up to 5 or more events", criteria: "Attend 5 events" },
  { name: "Recruiter", description: "Brought a new member into AKDFA", criteria: "1 successful referral" },
  { name: "Cricket Captain", description: "Named captain of a unit team", criteria: "Assigned as team captain" },
  { name: "Community Star", description: "Volunteered at a charity drive", criteria: "Log a charity contribution" },
];

const PRODUCTS = [
  { name: "AKDFA Home Jersey 2026", category: "JERSEY", price: 999, memberPrice: 799, sizesAvailable: ["S", "M", "L", "XL", "XXL"], stock: 120, description: "Official yellow-and-navy AKDFA supporter jersey." },
  { name: "AKDFA Training Cap", category: "CAP", price: 399, memberPrice: 299, sizesAvailable: ["One Size"], stock: 200, description: "Structured cotton cap with embroidered AKDFA crest." },
  { name: "AKDFA Match-Day Scarf", category: "SCARF", price: 499, memberPrice: 349, sizesAvailable: ["One Size"], stock: 150, description: "Knit scarf in association colours for stadium days." },
];

async function main() {
  // ---- Districts + units -------------------------------------------------
  let unitCount = 0;
  for (const d of DISTRICTS) {
    const district = await prisma.district.upsert({
      where: { code: d.code },
      update: { name: d.name, region: d.region },
      create: { code: d.code, name: d.name, region: d.region },
    });
    for (let i = 0; i < d.units.length; i++) {
      const u = d.units[i];
      await prisma.unit.upsert({
        where: { id: `${d.code}-unit-${i + 1}` },
        update: { name: u.name, status: "APPROVED", contactPhone: u.contactPhone, contactEmail: u.contactEmail },
        create: {
          id: `${d.code}-unit-${i + 1}`,
          districtId: district.id,
          name: u.name,
          status: "APPROVED",
          contactPhone: u.contactPhone,
          contactEmail: u.contactEmail,
        },
      });
      unitCount++;
    }
  }

  // ---- Bootstrap State Committee account -------------------------------
  const tvm = await prisma.district.findUnique({ where: { code: "TVM" } });
  const tvmUnit = await prisma.unit.findFirst({ where: { districtId: tvm.id } });
  const passwordHash = await bcrypt.hash(ADMIN.password, 12);
  const admin = await prisma.member.upsert({
    where: { emailHash: blindIndex(ADMIN.email) },
    update: { role: "STATE_ADMIN", status: "ACTIVE" },
    create: {
      memberNumber: "AKDFA-00001",
      unitId: tvmUnit.id,
      districtId: tvm.id,
      fullName: "AKDFA State Committee",
      email: ADMIN.email,
      phone: ADMIN.phone,
      passwordHash,
      role: "STATE_ADMIN",
      status: "ACTIVE",
      membershipExpiresAt: new Date(new Date().getFullYear() + 5, 2, 31),
    },
  });

  // ---- Badges + products ----------------------------------------------
  for (const b of BADGES) {
    await prisma.badge.upsert({ where: { name: b.name }, update: b, create: b });
  }
  for (const p of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) await prisma.product.update({ where: { id: existing.id }, data: p });
    else await prisma.product.create({ data: p });
  }

  // ---- A little starter content --------------------------------------
  const newsSeed = [
    {
      title: "AKDFA goes digital: the member platform is live",
      body: "The State Committee has approved Phase 1 of the digital roadmap. Members can now register online, and their local unit admin will approve them into an active membership with a digital card.",
    },
    {
      title: "17 units, 14 districts, one association",
      body: "Every district directory page is now backed by live data. Unit contacts, teams and events all flow from a single database.",
    },
  ];
  for (const n of newsSeed) {
    const exists = await prisma.newsPost.findFirst({ where: { title: n.title } });
    if (!exists) {
      await prisma.newsPost.create({
        data: { ...n, scope: "STATE", authorId: admin.id, publishedAt: new Date() },
      });
    }
  }

  const soon = (days) => new Date(Date.now() + days * 86400000);
  const eventSeed = [
    { title: "AKDFA Thrissur 5s Football Tournament", type: "TOURNAMENT", districtCode: "TSR", location: "LaLiga Turf, Thrissur", startsAt: soon(21) },
    { title: "State Committee Quarterly Meeting", type: "MEETING", scope: "STATE", location: "Kochi", startsAt: soon(30) },
    { title: "Ernakulam Blood Donation Drive", type: "CHARITY", districtCode: "EKM", location: "Ernakulam Town Hall", startsAt: soon(12) },
  ];
  for (const e of eventSeed) {
    const exists = await prisma.event.findFirst({ where: { title: e.title } });
    if (exists) continue;
    const district = e.districtCode ? await prisma.district.findUnique({ where: { code: e.districtCode } }) : null;
    await prisma.event.create({
      data: {
        title: e.title,
        type: e.type,
        scope: e.scope || (district ? "DISTRICT" : "STATE"),
        districtId: district?.id,
        location: e.location,
        startsAt: e.startsAt,
        createdById: admin.id,
      },
    });
  }

  console.log(`Seeded ${DISTRICTS.length} districts, ${unitCount} units, ${BADGES.length} badges, ${PRODUCTS.length} products.`);
  console.log(`State Committee login: ${ADMIN.email} / ${ADMIN.password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
