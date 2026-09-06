const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { requireRole, RANK } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { logAudit } = require("../admin/audit.service");

const router = Router();

function publicMember(member) {
  const { passwordHash, emailHash, phoneHash, ...rest } = member;
  return rest;
}

// Phase 4 — "see every member across the state in one directory."
// A district admin implicitly sees only their district by passing districtId;
// enforcement of "own district only" happens in the controller below.
router.get(
  "/",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  asyncHandler(async (req, res) => {
    const { status, unitId } = req.query;
    let { districtId } = req.query;

    if (req.auth.role === "DISTRICT_ADMIN") districtId = req.auth.districtId;
    const include = { unit: { select: { name: true } }, district: { select: { name: true } } };
    if (req.auth.role === "UNIT_ADMIN") {
      const members = await prisma.member.findMany({
        where: { unitId: req.auth.unitId, status: status || undefined },
        orderBy: { fullName: "asc" },
        include,
      });
      return res.json({ members: members.map(publicMember) });
    }

    const members = await prisma.member.findMany({
      where: { districtId: districtId || undefined, unitId: unitId || undefined, status: status || undefined },
      orderBy: { fullName: "asc" },
      include,
    });
    res.json({ members: members.map(publicMember) });
  })
);

// Aggregate everything the member dashboard needs in one call.
router.get(
  "/me/dashboard",
  requireAuth,
  asyncHandler(async (req, res) => {
    const memberId = req.auth.id;
    const now = new Date();
    const [member, badges, referrals, unreadNotifications, upcomingRsvps, latestFee] = await Promise.all([
      prisma.member.findUnique({ where: { id: memberId }, include: { unit: true, district: true } }),
      prisma.memberBadge.findMany({ where: { memberId }, include: { badge: true }, orderBy: { awardedAt: "desc" } }),
      prisma.referral.findMany({
        where: { referrerId: memberId },
        include: { referred: { select: { fullName: true, memberNumber: true, status: true } } },
      }),
      prisma.notification.count({ where: { memberId, readAt: null } }),
      prisma.eventRsvp.findMany({
        where: { memberId, status: { in: ["GOING", "INTERESTED"] }, event: { startsAt: { gte: now } } },
        include: { event: true },
        orderBy: { event: { startsAt: "asc" } },
        take: 5,
      }),
      prisma.membershipFee.findFirst({ where: { memberId }, orderBy: { period: "desc" } }),
    ]);
    if (!member) throw ApiError.notFound("Member not found");
    res.json({
      member: publicMember(member),
      badges,
      referrals,
      unreadNotifications,
      upcomingEvents: upcomingRsvps.map((r) => ({ ...r.event, rsvp: r.status })),
      latestFee,
    });
  })
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const isSelf = req.auth.id === req.params.id;
    if (!isSelf && RANK[req.auth.role] < 1) {
      throw ApiError.forbidden();
    }
    const member = await prisma.member.findUnique({
      where: { id: req.params.id },
      include: { unit: true, district: true, badges: { include: { badge: true } } },
    });
    if (!member) throw ApiError.notFound("Member not found");
    res.json({ member: publicMember(member) });
  })
);

// Phase 2 — the digital membership card: name, member number, district, role.
router.get(
  "/:id/card",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.auth.id !== req.params.id && req.auth.role === "MEMBER") {
      throw ApiError.forbidden();
    }
    const member = await prisma.member.findUnique({
      where: { id: req.params.id },
      include: { unit: true, district: true },
    });
    if (!member) throw ApiError.notFound("Member not found");
    if (member.status !== "ACTIVE") throw ApiError.badRequest("Card is only valid for active members");

    res.json({
      card: {
        memberNumber: member.memberNumber,
        fullName: member.fullName,
        role: member.role,
        district: member.district.name,
        unit: member.unit.name,
        expiresAt: member.membershipExpiresAt,
      },
    });
  })
);

// Phase 3 — "Approve new members: Review and approve new members joining in their area."
router.post(
  "/:id/approve",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  asyncHandler(async (req, res) => {
    const target = await prisma.member.findUnique({ where: { id: req.params.id } });
    if (!target) throw ApiError.notFound("Member not found");
    if (req.auth.role === "UNIT_ADMIN" && target.unitId !== req.auth.unitId) throw ApiError.forbidden();
    if (req.auth.role === "DISTRICT_ADMIN" && target.districtId !== req.auth.districtId) throw ApiError.forbidden();

    const member = await prisma.member.update({
      where: { id: req.params.id },
      data: {
        status: "ACTIVE",
        approvedById: req.auth.id,
        membershipExpiresAt: new Date(new Date().getFullYear() + 1, 2, 31),
      },
    });
    // A pending referral for this member moves to JOINED once they're active.
    await prisma.referral.updateMany({
      where: { referredId: member.id, status: "PENDING" },
      data: { status: "JOINED" },
    });
    await prisma.notification.create({
      data: {
        memberId: member.id,
        title: "Welcome to AKDFA",
        body: "Your membership has been approved. Your digital card is now active.",
        category: "ANNOUNCEMENT",
      },
    });
    await logAudit(req.auth.id, "MEMBER_APPROVED", "Member", member.id);
    res.json({ member: publicMember(member) });
  })
);

const updateSchema = z.object({
  fullName: z.string().min(2).optional(),
  profilePhotoUrl: z.string().url().optional(),
  phone: z.string().min(8).optional(),
});

router.patch(
  "/:id",
  requireAuth,
  validate({ body: updateSchema }),
  asyncHandler(async (req, res) => {
    if (req.auth.id !== req.params.id && req.auth.role === "MEMBER") throw ApiError.forbidden();
    const member = await prisma.member.update({ where: { id: req.params.id }, data: req.body });
    res.json({ member: publicMember(member) });
  })
);

// Phase 4 — "decide who is allowed to approve what": promote/demote a member's role.
router.patch(
  "/:id/role",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  validate({ body: z.object({ role: z.enum(["MEMBER", "UNIT_ADMIN", "DISTRICT_ADMIN", "STATE_ADMIN"]) }) }),
  asyncHandler(async (req, res) => {
    // Only STATE_ADMIN can grant STATE_ADMIN or DISTRICT_ADMIN.
    if (["STATE_ADMIN", "DISTRICT_ADMIN"].includes(req.body.role) && req.auth.role !== "STATE_ADMIN") {
      throw ApiError.forbidden("Only the State Committee can grant this role");
    }
    const member = await prisma.member.update({
      where: { id: req.params.id },
      data: { role: req.body.role },
    });
    await logAudit(req.auth.id, "MEMBER_ROLE_CHANGED", "Member", member.id, { newRole: req.body.role });
    res.json({ member: publicMember(member) });
  })
);

module.exports = router;
