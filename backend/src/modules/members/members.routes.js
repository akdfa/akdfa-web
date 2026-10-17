const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { requireRole, RANK } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { logAudit } = require("../admin/audit.service");
const { notify } = require("../notifications/notify.service");

const crypto = require("crypto");
const env = require("../../config/env");
const { hashPassword } = require("../../utils/password");
const { sendMail } = require("../../utils/mail");
const { assertCanManage, canViewMember, scopeOfMember } = require("../../middleware/scope");

const router = Router();

function publicMember(member) {
  const { passwordHash, emailHash, phoneHash, ...rest } = member;
  return rest;
}

// An admin enters a member directly (joined at a meeting, no web access, etc.).
// The member is ACTIVE immediately, with no password set: they get a one-time
// "set your password" link (also returned to the admin so it can be shared on
// WhatsApp). Scope: unit admin → own unit; district admin → units in their
// district; state admin → any unit.
router.post(
  "/",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({
    body: z.object({
      unitId: z.string().optional(),
      fullName: z.string().min(2),
      email: z.string().email(),
      phone: z.string().min(8),
      dateOfBirth: z.coerce.date().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const unitId = req.auth.role === "UNIT_ADMIN" ? req.auth.unitId : req.body.unitId || req.auth.unitId;
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit || unit.status !== "APPROVED") throw ApiError.badRequest("Choose an approved unit");
    if (req.auth.role === "DISTRICT_ADMIN" && unit.districtId !== req.auth.districtId) throw ApiError.forbidden("That unit is outside your district");

    const { fullName, email, phone, dateOfBirth } = req.body;
    const passwordHash = await hashPassword(crypto.randomBytes(24).toString("hex")); // unknowable until they reset
    let member;
    for (let attempt = 0; attempt < 5 && !member; attempt++) {
      const memberNumber = `AKDFA-${String((await prisma.member.count()) + 1 + attempt).padStart(5, "0")}`;
      try {
        member = await prisma.member.create({
          data: {
            memberNumber, unitId: unit.id, districtId: unit.districtId, fullName, email, phone, passwordHash,
            dateOfBirth: dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : undefined,
            status: "ACTIVE",
            approvedById: req.auth.id,
            membershipExpiresAt: new Date(new Date().getFullYear() + 1, 2, 31),
          },
        });
      } catch (err) {
        if (err.code === "P2002" && String(err.meta?.target).includes("memberNumber")) continue; // number race — retry
        throw err;
      }
    }
    if (!member) throw ApiError.conflict("Could not allocate a member number, try again");

    const rawToken = crypto.randomBytes(32).toString("hex");
    await prisma.passwordReset.create({
      data: {
        memberId: member.id,
        tokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    const setupUrl = `${env.siteBaseUrl.replace(/\/$/, "")}/reset.html?token=${rawToken}`;
    sendMail({
      to: email,
      subject: "Welcome to AKDFA — set your password",
      text: `Hi ${fullName},\n\nYou've been added to ${unit.name} as an AKDFA member (${member.memberNumber}).\nSet your password to sign in (link valid for 7 days):\n${setupUrl}`,
    }).catch(() => {});

    await logAudit(req.auth.id, "MEMBER_CREATED", "Member", member.id, { unitId: unit.id });
    res.status(201).json({ member: publicMember(member), setupUrl });
  })
);

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
    const member = await prisma.member.findUnique({
      where: { id: req.params.id },
      include: { unit: true, district: true, badges: { include: { badge: true } } },
    });
    if (!member) throw ApiError.notFound("Member not found");
    // Yourself, or an admin whose unit/district covers this member. Anyone else gets a 404-style refusal.
    if (!canViewMember(req.auth, member)) throw ApiError.forbidden();
    res.json({ member: publicMember(member) });
  })
);

// Phase 2 — the digital membership card: name, member number, district, role.
router.get(
  "/:id/card",
  requireAuth,
  asyncHandler(async (req, res) => {
    const member = await prisma.member.findUnique({
      where: { id: req.params.id },
      include: { unit: true, district: true },
    });
    if (!member) throw ApiError.notFound("Member not found");
    if (!canViewMember(req.auth, member)) throw ApiError.forbidden(); // the card carries a valid verification signature
    if (member.status !== "ACTIVE") throw ApiError.badRequest("Card is only valid for active members");

    const sig = require("../../utils/crypto").cardVerifyToken(member.memberNumber);
    const verifyUrl = `${require("../../config/env").siteBaseUrl.replace(/\/$/, "")}/verify.html?m=${encodeURIComponent(
      member.memberNumber
    )}&sig=${sig}`;

    res.json({
      card: {
        memberNumber: member.memberNumber,
        fullName: member.fullName,
        role: member.role,
        district: member.district.name,
        unit: member.unit.name,
        expiresAt: member.membershipExpiresAt,
        verifyUrl,
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
    await notify(member.id, {
      title: "Welcome to AKDFA",
      body: "Your membership has been approved. Your digital card is now active.",
      category: "ANNOUNCEMENT",
      force: true,
    });
    await logAudit(req.auth.id, "MEMBER_APPROVED", "Member", member.id);
    res.json({ member: publicMember(member) });
  })
);

// Reject a pending application.
router.post(
  "/:id/reject",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({ body: z.object({ reason: z.string().optional() }).optional() }),
  asyncHandler(async (req, res) => {
    const target = await prisma.member.findUnique({ where: { id: req.params.id } });
    if (!target) throw ApiError.notFound("Member not found");
    if (target.status !== "PENDING") throw ApiError.badRequest("Only pending members can be rejected");
    if (req.auth.role === "UNIT_ADMIN" && target.unitId !== req.auth.unitId) throw ApiError.forbidden();
    if (req.auth.role === "DISTRICT_ADMIN" && target.districtId !== req.auth.districtId) throw ApiError.forbidden();

    const member = await prisma.member.update({ where: { id: target.id }, data: { status: "REJECTED" } });
    await logAudit(req.auth.id, "MEMBER_REJECTED", "Member", member.id, { reason: req.body?.reason });
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
    const target = await prisma.member.findUnique({ where: { id: req.params.id } });
    if (!target) throw ApiError.notFound("Member not found");
    if (!canViewMember(req.auth, target)) throw ApiError.forbidden();
    const member = await prisma.member.update({ where: { id: req.params.id }, data: req.body });
    res.json({ member: publicMember(member) });
  })
);

// The State Committee resets an ADMIN account's password (unit/district/state admins only; regular members
// always use "Forgot password"). Without a body it creates a one-time reset link (emailed and returned so it can
// be shared on WhatsApp); with { password } it sets a temporary password. Every existing session is signed out.
router.post(
  "/:id/reset-password",
  requireAuth,
  requireRole("STATE_ADMIN"),
  validate({ body: z.object({ password: z.string().min(8).max(128).optional() }).optional() }),
  asyncHandler(async (req, res) => {
    const target = await prisma.member.findUnique({ where: { id: req.params.id } });
    if (!target) throw ApiError.notFound("Member not found");
    if (req.auth.role === "UNIT_ADMIN" && target.unitId !== req.auth.unitId) throw ApiError.forbidden();
    if (req.auth.role === "DISTRICT_ADMIN" && target.districtId !== req.auth.districtId) throw ApiError.forbidden();
    // Regular members are never reset by the committee; they use "Forgot password" themselves.
    if (target.role === "MEMBER") {
      throw ApiError.forbidden("Members reset their own password with 'Forgot password'. The committee cannot reset it for them.");
    }
    if (req.auth.role !== "STATE_ADMIN") throw ApiError.forbidden("Only the State Committee can reset an admin's password");

    const revoke = prisma.refreshToken.updateMany({ where: { memberId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
    const password = req.body?.password;
    if (password) {
      await prisma.$transaction([
        prisma.member.update({ where: { id: target.id }, data: { passwordHash: await hashPassword(password) } }),
        prisma.passwordReset.updateMany({ where: { memberId: target.id, usedAt: null }, data: { usedAt: new Date() } }),
        revoke,
      ]);
      await logAudit(req.auth.id, "PASSWORD_RESET_BY_ADMIN", "Member", target.id, { mode: "temporary-password" });
      return res.json({ ok: true, mode: "password" });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    await prisma.$transaction([
      prisma.passwordReset.updateMany({ where: { memberId: target.id, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.passwordReset.create({
        data: {
          memberId: target.id,
          tokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      }),
      revoke,
    ]);
    const resetUrl = `${env.siteBaseUrl.replace(/\/$/, "")}/reset.html?token=${rawToken}`;
    sendMail({
      to: target.email,
      subject: "Reset your AKDFA password",
      text: `Hi ${target.fullName},\n\nAn AKDFA administrator started a password reset for your account.\nChoose a new password here (link valid for 24 hours):\n${resetUrl}`,
    }).catch(() => {});
    await logAudit(req.auth.id, "PASSWORD_RESET_BY_ADMIN", "Member", target.id, { mode: "reset-link" });
    res.json({ ok: true, mode: "link", resetUrl });
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
    const target = await prisma.member.findUnique({ where: { id: req.params.id } });
    if (!target) throw ApiError.notFound("Member not found");
    assertCanManage(req.auth, scopeOfMember(target), "You can only change roles inside your own district");
    // Nobody changes the role of someone at or above their own level (except the State Committee).
    if (req.auth.role !== "STATE_ADMIN" && RANK[target.role] >= RANK[req.auth.role]) throw ApiError.forbidden("You cannot change this member's role");
    const member = await prisma.member.update({
      where: { id: req.params.id },
      data: { role: req.body.role },
    });
    await logAudit(req.auth.id, "MEMBER_ROLE_CHANGED", "Member", member.id, { newRole: req.body.role });
    res.json({ member: publicMember(member) });
  })
);

module.exports = router;
