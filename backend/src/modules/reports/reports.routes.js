const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");

const router = Router();

// Phase 4 — "Every district submits a monthly activity report ... so the Committee
// always knows what's happening on the ground."

router.get(
  "/",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  asyncHandler(async (req, res) => {
    const { districtId } = req.query;
    const reports = await prisma.districtActivityReport.findMany({
      where: { districtId: req.auth.role === "STATE_ADMIN" ? districtId || undefined : req.auth.districtId },
      orderBy: { month: "desc" },
      include:
        req.auth.role === "STATE_ADMIN"
          ? { district: { select: { name: true, code: true } }, submittedBy: { select: { fullName: true } } }
          : undefined,
    });
    res.json({ reports });
  })
);

router.post(
  "/",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  validate({
    body: z.object({
      month: z.coerce.date(),
      eventsRun: z.number().int().min(0).default(0),
      teamsManaged: z.number().int().min(0).default(0),
      summary: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const report = await prisma.districtActivityReport.upsert({
      where: { districtId_month: { districtId: req.auth.districtId, month: req.body.month } },
      update: { ...req.body, submittedById: req.auth.id, submittedAt: new Date() },
      create: { ...req.body, districtId: req.auth.districtId, submittedById: req.auth.id },
    });
    res.status(201).json({ report });
  })
);

// Phase 4 — "See total membership, fee collection, and growth trends across the whole state."
router.get(
  "/state-overview",
  requireAuth,
  requireRole("STATE_ADMIN"),
  asyncHandler(async (req, res) => {
    const [totalMembers, activeMembers, districts, feesCollected] = await Promise.all([
      prisma.member.count(),
      prisma.member.count({ where: { status: "ACTIVE" } }),
      prisma.district.count(),
      prisma.membershipFee.aggregate({ _sum: { amount: true }, where: { status: "SUCCESS" } }),
    ]);
    res.json({
      totalMembers,
      activeMembers,
      districts,
      feesCollected: feesCollected._sum.amount || 0,
    });
  })
);

// Phase 4 — "growth trends across the whole state": last 12 months of
// member sign-ups and fee collection, plus a per-district breakdown.
router.get(
  "/trends",
  requireAuth,
  requireRole("STATE_ADMIN"),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      months.push({ label: start.toISOString().slice(0, 7), start, end });
    }

    const [members, fees, byDistrict] = await Promise.all([
      prisma.member.findMany({
        where: { joinedAt: { gte: months[0].start } },
        select: { joinedAt: true },
      }),
      prisma.membershipFee.findMany({
        where: { status: "SUCCESS", paidAt: { gte: months[0].start } },
        select: { paidAt: true, amount: true },
      }),
      prisma.district.findMany({
        select: { id: true, name: true, code: true, _count: { select: { members: true, units: true } } },
        orderBy: { name: "asc" },
      }),
    ]);

    const series = months.map((m) => ({
      month: m.label,
      newMembers: members.filter((x) => x.joinedAt >= m.start && x.joinedAt < m.end).length,
      feesCollected: fees
        .filter((x) => x.paidAt >= m.start && x.paidAt < m.end)
        .reduce((sum, x) => sum + Number(x.amount), 0),
    }));

    res.json({ series, districts: byDistrict });
  })
);

module.exports = router;
