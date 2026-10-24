const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const crypto = require("crypto");
const env = require("../../config/env");
const { hashPassword, comparePassword } = require("../../utils/password");
const { blindIndex } = require("../../utils/crypto");
const { sendMail } = require("../../utils/mail");
const { notify } = require("../notifications/notify.service");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} = require("../../utils/jwt");

const router = Router();

const registerSchema = z.object({
  unitId: z.string().min(1),
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  password: z.string().min(8),
  dateOfBirth: z.coerce.date().optional(),
  referrerId: z.string().optional(), // member id of whoever invited them
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

async function nextMemberNumber() {
  const count = await prisma.member.count();
  return `AKDFA-${String(count + 1).padStart(5, "0")}`;
}

async function issueTokens(member) {
  const accessToken = signAccessToken(member);
  const refreshToken = signRefreshToken(member);

  await prisma.refreshToken.create({
    data: {
      memberId: member.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken };
}

function publicMember(member) {
  const { passwordHash, emailHash, phoneHash, ...rest } = member;
  return rest;
}

// Anyone can self-register — lands as PENDING until a unit/district admin approves them.
// This is the "basic sign-in page" from Phase 0 growing into the real account system in Phase 1.
router.post(
  "/register",
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const { unitId, fullName, email, phone, password, dateOfBirth, referrerId } = req.body;

    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw ApiError.badRequest("Unknown unitId");

    const passwordHash = await hashPassword(password);
    const memberNumber = await nextMemberNumber();

    const member = await prisma.member.create({
      data: {
        unitId: unit.id,
        districtId: unit.districtId,
        memberNumber,
        fullName,
        email,
        phone,
        passwordHash,
        dateOfBirth: dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : undefined,
      },
    });

    if (referrerId) {
      const referrer = await prisma.member.findUnique({ where: { id: referrerId } });
      if (referrer) {
        await prisma.referral.create({ data: { referrerId, referredId: member.id } }).catch(() => {});
      }
    }

    // Tell the people who can approve this person (their unit's admins + the
    // district's admins) that someone is waiting. Never let this fail the signup.
    prisma.member
      .findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { unitId: unit.id, role: { in: ["UNIT_ADMIN", "DISTRICT_ADMIN", "STATE_ADMIN"] } },
            { districtId: unit.districtId, role: "DISTRICT_ADMIN" },
          ],
        },
        select: { id: true },
      })
      .then((admins) =>
        notify(admins.map((x) => x.id), {
          title: "New membership request",
          body: `${fullName} has asked to join ${unit.name}. Review it under Members → Pending.`,
          category: "MEMBERSHIP",
          force: true,
        })
      )
      .catch(() => {});

    res.status(201).json({ member: publicMember(member) });
  })
);

router.post(
  "/login",
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const member = await prisma.member.findUnique({ where: { emailHash: blindIndex(email) } });
    if (!member || !(await comparePassword(password, member.passwordHash))) {
      throw ApiError.unauthorized("Invalid email or password");
    }
    if (member.status === "SUSPENDED") {
      throw ApiError.forbidden("This account has been suspended");
    }
    if (member.status === "REJECTED") {
      throw ApiError.forbidden("This membership application was not approved");
    }

    const tokens = await issueTokens(member);
    res.json({ member: publicMember(member), ...tokens });
  })
);

router.post(
  "/refresh",
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized("Invalid refresh token");
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw ApiError.unauthorized("Refresh token expired or revoked");
    }

    const member = await prisma.member.findUnique({ where: { id: payload.sub } });
    if (!member) throw ApiError.unauthorized("Member no longer exists");

    // Rotate: revoke the old refresh token, issue a new pair.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await issueTokens(member);

    res.json({ ...tokens });
  })
);

router.post(
  "/logout",
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.status(204).send();
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const member = await prisma.member.findUnique({
      where: { id: req.auth.id },
      include: { unit: true, district: true },
    });
    if (!member) throw ApiError.notFound("Member not found");
    res.json({ member: publicMember(member) });
  })
);

/* ---- password reset ------------------------------------------------ */

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");

// Always responds 200 — never reveals whether an email is registered.
router.post(
  "/forgot-password",
  validate({ body: z.object({ email: z.string().email() }) }),
  asyncHandler(async (req, res) => {
    const member = await prisma.member.findUnique({ where: { emailHash: blindIndex(req.body.email) } });
    let devResetUrl;

    if (member && member.status !== "REJECTED") {
      await prisma.passwordReset.updateMany({
        where: { memberId: member.id, usedAt: null },
        data: { usedAt: new Date() }, // invalidate any earlier outstanding tokens
      });
      const rawToken = crypto.randomBytes(32).toString("hex");
      const reset = await prisma.passwordReset.create({
        data: { memberId: member.id, tokenHash: sha256(rawToken), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
      });
      const url = `${env.siteBaseUrl.replace(/\/$/, "")}/reset.html?token=${rawToken}`;
      try {
        await sendMail({
          to: req.body.email,
          idempotencyKey: `password-reset/${reset.id}`,
          subject: "Reset your AKDFA password",
          text: `Someone asked to reset the password for your AKDFA account.\n\nOpen this link within 1 hour to choose a new password:\n${url}\n\nIf this wasn't you, ignore this email — your password stays unchanged.`,
          html: `<p>Someone asked to reset the password for your AKDFA account.</p><p><a href="${url}">Choose a new password</a> (link valid for 1 hour).</p><p>If this wasn't you, ignore this email — your password stays unchanged.</p>`,
        });
      } catch (err) {
        // Same response either way, so a mail failure can't reveal whether the email is registered.
        console.error("[auth] password reset email failed:", err.message); // eslint-disable-line no-console
      }
      if (!env.isProd) devResetUrl = url;
    }

    res.json({ ok: true, message: "If that email has an account, a reset link is on its way.", ...(devResetUrl ? { devResetUrl } : {}) });
  })
);

router.post(
  "/reset-password",
  validate({ body: z.object({ token: z.string().min(10), password: z.string().min(8) }) }),
  asyncHandler(async (req, res) => {
    const record = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(req.body.token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw ApiError.badRequest("This reset link is invalid or has expired. Request a new one.");
    }
    const passwordHash = await hashPassword(req.body.password);
    await prisma.$transaction([
      prisma.member.update({ where: { id: record.memberId }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Force re-login everywhere.
      prisma.refreshToken.updateMany({ where: { memberId: record.memberId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    res.json({ ok: true });
  })
);

// Logged-in member changing their own password.
router.post(
  "/change-password",
  requireAuth,
  validate({ body: z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) }) }),
  asyncHandler(async (req, res) => {
    const member = await prisma.member.findUnique({ where: { id: req.auth.id } });
    if (!member || !(await comparePassword(req.body.currentPassword, member.passwordHash))) {
      throw ApiError.badRequest("Current password is incorrect");
    }
    const passwordHash = await hashPassword(req.body.newPassword);
    await prisma.$transaction([
      prisma.member.update({ where: { id: member.id }, data: { passwordHash } }),
      prisma.refreshToken.updateMany({ where: { memberId: member.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    // Issue a fresh pair so the current device stays signed in.
    const tokens = await issueTokens(member);
    res.json({ ok: true, ...tokens });
  })
);

module.exports = router;
