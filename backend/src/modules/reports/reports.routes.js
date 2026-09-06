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

module.exports = router;
