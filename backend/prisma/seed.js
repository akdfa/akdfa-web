// Seeds AKDFA reference data:
//   - 14 Kerala districts + 2 out-of-state + 1 ladies unit  = 17 units total
//   - the bootstrap State Committee account (from .env BOOTSTRAP_ADMIN_*)
//   - a starter set of badges and store products
//   - a couple of published news posts and calendar events so the app isn't empty
//
// Safe to re-run: everything is upserted.
require("../src/config/env"); // loads .env.<NODE_ENV> then .env
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
    const bio = `AKDFA ${d.name} brings supporters across ${d.region} together — running local tournaments and charity drives, backing young cricketers, and keeping the association's spirit alive on the ground.`;
    const district = await prisma.district.upsert({
      where: { code: d.code },
      update: { name: d.name, region: d.region, bio },
      create: { code: d.code, name: d.name, region: d.region, bio },
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

  // ---- Demo data (set SEED_DEMO=off to skip) --------------------------
  if (process.env.SEED_DEMO !== "off") {
    await seedDemo(admin);
  }

  console.log(`Seeded ${DISTRICTS.length} districts, ${unitCount} units, ${BADGES.length} badges, ${PRODUCTS.length} products.`);
  console.log(`State Committee login: ${ADMIN.email} / ${ADMIN.password}`);
}

// A small but realistic slice of activity so the app isn't empty on first run.
async function seedDemo(admin) {
  const pw = await bcrypt.hash("member-demo-2026", 12);
  const ekm = await prisma.district.findUnique({ where: { code: "EKM" } });
  const tsr = await prisma.district.findUnique({ where: { code: "TSR" } });
  const ekmUnit = await prisma.unit.findFirst({ where: { districtId: ekm.id } });
  const tsrUnit = await prisma.unit.findFirst({ where: { districtId: tsr.id } });

  const nextNumber = async () => `AKDFA-${String((await prisma.member.count()) + 1).padStart(5, "0")}`;
  async function demoMember(fullName, email, phone, unit, district, role = "MEMBER") {
    const existing = await prisma.member.findUnique({ where: { emailHash: blindIndex(email) } });
    if (existing) return existing;
    return prisma.member.create({
      data: {
        memberNumber: await nextNumber(),
        unitId: unit.id,
        districtId: district.id,
        fullName,
        email,
        phone,
        passwordHash: pw,
        role,
        status: "ACTIVE",
        membershipExpiresAt: new Date(new Date().getFullYear() + 1, 2, 31),
      },
    });
  }

  const ekmAdmin = await demoMember("Renish Kumar", "renish.demo@akdfa.org", "+919000000101", ekmUnit, ekm, "DISTRICT_ADMIN");
  const p1 = await demoMember("Akhil S", "akhil.demo@akdfa.org", "+919000000102", ekmUnit, ekm);
  const p2 = await demoMember("Bibin Joseph", "bibin.demo@akdfa.org", "+919000000103", ekmUnit, ekm);
  const p3 = await demoMember("Sana Rahman", "sana.demo@akdfa.org", "+919000000104", ekmUnit, ekm);
  await demoMember("Meera K", "meera.demo@akdfa.org", "+919000000105", tsrUnit, tsr, "UNIT_ADMIN");
  await prisma.member.create({
    data: {
      memberNumber: await nextNumber(), unitId: ekmUnit.id, districtId: ekm.id,
      fullName: "Pending Applicant", email: "pending.demo@akdfa.org", phone: "+919000000106",
      passwordHash: pw, status: "PENDING",
    },
  }).catch(() => {});

  // Team + roster + a completed match
  const team = await prisma.team.upsert({
    where: { unitId_name_season: { unitId: ekmUnit.id, name: "Kochi Blues", season: String(new Date().getFullYear()) } },
    update: { captainId: p1.id },
    create: { unitId: ekmUnit.id, name: "Kochi Blues", season: String(new Date().getFullYear()), captainId: p1.id },
  });
  const away = await prisma.team.upsert({
    where: { unitId_name_season: { unitId: tsrUnit.id, name: "Thrissur Kings", season: String(new Date().getFullYear()) } },
    update: {},
    create: { unitId: tsrUnit.id, name: "Thrissur Kings", season: String(new Date().getFullYear()) },
  });
  for (const [m, pos, num] of [[p1, "Batter", 7], [p2, "Bowler", 11], [p3, "All-rounder", 18]]) {
    await prisma.player.upsert({ where: { memberId: m.id }, update: { teamId: team.id }, create: { memberId: m.id, teamId: team.id, position: pos, jerseyNumber: num } });
  }
  const haveMatch = await prisma.match.findFirst({ where: { homeTeamId: team.id, awayTeamId: away.id } });
  if (!haveMatch) {
    await prisma.match.create({
      data: {
        homeTeamId: team.id, awayTeamId: away.id, venue: "Maharaja's Ground, Kochi",
        scheduledAt: new Date(Date.now() - 7 * 86400000), status: "COMPLETED",
        homeScore: "148/6", awayScore: "142/9", resultSummary: "Kochi Blues won by 6 runs",
      },
    });
    await prisma.match.create({
      data: { homeTeamId: away.id, awayTeamId: team.id, venue: "Thrissur", scheduledAt: new Date(Date.now() + 10 * 86400000), status: "SCHEDULED" },
    });
  }

  // A poll
  if (!(await prisma.poll.findFirst({ where: { question: { contains: "player of the tournament" } } }))) {
    await prisma.poll.create({
      data: {
        question: "Who was your player of the tournament?", scope: "STATE", createdById: admin.id,
        options: { create: [{ label: "Akhil S" }, { label: "Bibin Joseph" }, { label: "Sana Rahman" }] },
      },
    });
  }

  // Sponsors
  for (const s of [
    { name: "Kerala Sports Co.", tier: "GOLD", isPublic: true, website: "https://example.com" },
    { name: "Backwater Foods", tier: "SILVER", isPublic: true, districtId: ekm.id },
    { name: "Local Well-wisher", tier: "COMMUNITY", isPublic: false, districtId: ekm.id },
  ]) {
    if (!(await prisma.sponsor.findFirst({ where: { name: s.name } }))) await prisma.sponsor.create({ data: s });
  }

  // Charity event + report
  let charityEvent = await prisma.event.findFirst({ where: { title: "Ernakulam Blood Donation Drive" } });
  if (charityEvent && !(await prisma.charityReport.findUnique({ where: { eventId: charityEvent.id } }))) {
    await prisma.charityReport.create({
      data: {
        eventId: charityEvent.id, submittedById: ekmAdmin.id,
        peopleHelped: 120, amountRaised: 0, amountSpent: 8500,
        beneficiary: "Ernakulam General Hospital blood bank",
        summary: "42 units of blood collected across the day; refreshments and transport covered by the unit.",
      },
    });
  }

  console.log("Demo data: 6 members (1 pending), 2 teams, 2 matches, 1 poll, 3 sponsors, 1 charity report.");
  console.log("Demo member login: akhil.demo@akdfa.org / member-demo-2026  (district admin: renish.demo@akdfa.org)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
