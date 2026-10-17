const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { assertCanManage, scopeOfMember } = require("../../middleware/scope");

const { requireActive } = require("../../middleware/requireActive");

const router = Router();

// ---- Badges (Phase 2) -----------------------------------------------------

router.get(
  "/badges",
  asyncHandler(async (req, res) => {
    const badges = await prisma.badge.findMany();
    res.json({ badges });
  })
);

router.post(
  "/badges",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  validate({ body: z.object({ name: z.string().min(2), description: z.string().optional(), iconUrl: z.string().url().optional(), criteria: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const badge = await prisma.badge.create({ data: req.body });
    res.status(201).json({ badge });
  })
);

router.post(
  "/badges/:badgeId/award/:memberId",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  asyncHandler(async (req, res) => {
    const target = await prisma.member.findUnique({ where: { id: req.params.memberId } });
    if (!target) throw ApiError.notFound("Member not found");
    assertCanManage(req.auth, scopeOfMember(target), "You can only award badges to members in your own unit or district");
    const memberBadge = await prisma.memberBadge.upsert({
      where: { memberId_badgeId: { memberId: req.params.memberId, badgeId: req.params.badgeId } },
      update: {},
      create: { memberId: req.params.memberId, badgeId: req.params.badgeId },
    });
    res.status(201).json({ memberBadge });
  })
);

router.get(
  "/me/badges",
  requireAuth,
  asyncHandler(async (req, res) => {
    const badges = await prisma.memberBadge.findMany({ where: { memberId: req.auth.id }, include: { badge: true } });
    res.json({ badges });
  })
);

// ---- Referrals (Phase 2) ---------------------------------------------------
// "Small rewards for ... bringing in new members." A referral is recorded when
// a new member registers with a referrerId (see auth.routes.js register flow —
// pass ?ref=<memberId> and wire it there if/when the referral UI ships).

router.post(
  "/referrals",
  requireAuth,
  requireActive,
  validate({ body: z.object({ referredId: z.string() }) }),
  asyncHandler(async (req, res) => {
    if (req.body.referredId === req.auth.id) throw ApiError.badRequest("You cannot refer yourself");
    const referred = await prisma.member.findUnique({ where: { id: req.body.referredId }, select: { id: true } });
    if (!referred) throw ApiError.notFound("Member not found");
    const referral = await prisma.referral.create({
      data: { referrerId: req.auth.id, referredId: req.body.referredId },
    });
    res.status(201).json({ referral });
  })
);

router.get(
  "/me/referrals",
  requireAuth,
  asyncHandler(async (req, res) => {
    const referrals = await prisma.referral.findMany({
      where: { referrerId: req.auth.id },
      include: { referred: { select: { fullName: true, memberNumber: true } } },
    });
    res.json({ referrals });
  })
);

// A district/unit admin marks a referral rewarded once the referred member goes ACTIVE.
router.post(
  "/referrals/:id/reward",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.referral.findUnique({ where: { id: req.params.id }, include: { referrer: { select: { districtId: true, unitId: true } } } });
    if (!existing) throw ApiError.notFound("Referral not found");
    assertCanManage(req.auth, scopeOfMember(existing.referrer), "You can only reward referrals from your own unit or district");
    const referral = await prisma.referral.update({
      where: { id: req.params.id },
      data: { status: "REWARDED", rewardGrantedAt: new Date() },
    });
    res.json({ referral });
  })
);

module.exports = router;
