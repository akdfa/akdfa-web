const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { hashPassword, comparePassword } = require("../../utils/password");
const { blindIndex } = require("../../utils/crypto");
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

module.exports = router;
