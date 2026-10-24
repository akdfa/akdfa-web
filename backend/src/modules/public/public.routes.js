const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { blindIndex, cardVerifyToken } = require("../../utils/crypto");
const { getPrivateStream, privateExists } = require("../../middleware/upload");

const router = Router();

// Phase 4 — PUBLIC official documents, visible on the website with no login.
router.get(
  "/documents",
  asyncHandler(async (req, res) => {
    const documents = await prisma.document.findMany({
      where: { visibility: "PUBLIC" },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, type: true, originalName: true, fileSize: true, createdAt: true },
    });
    res.json({ documents });
  })
);

router.get(
  "/documents/:id/file",
  asyncHandler(async (req, res) => {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc || doc.visibility !== "PUBLIC") throw ApiError.notFound("Document not found");
    if (!(await privateExists(doc.fileKey))) throw ApiError.notFound("File is missing from storage");
    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.originalName || doc.title)}"`);
    (await getPrivateStream(doc.fileKey)).pipe(res);
  })
);

// Phase 1 — "a simple newsletter signup for people who aren't ready to join yet."
router.post(
  "/newsletter",
  validate({ body: z.object({ email: z.string().email() }) }),
  asyncHandler(async (req, res) => {
    const subscriber = await prisma.newsletterSubscriber.upsert({
      where: { emailHash: blindIndex(req.body.email) },
      update: { unsubscribedAt: null },
      create: { email: req.body.email },
    });
    res.status(201).json({ subscriber: { id: subscriber.id, subscribedAt: subscriber.subscribedAt } });
  })
);

router.post(
  "/newsletter/unsubscribe",
  validate({ body: z.object({ email: z.string().email() }) }),
  asyncHandler(async (req, res) => {
    await prisma.newsletterSubscriber.updateMany({
      where: { emailHash: blindIndex(req.body.email) },
      data: { unsubscribedAt: new Date() },
    });
    res.status(204).send();
  })
);

// Phase 2 — verify a digital membership card scanned at an event gate.
router.get(
  "/members/verify",
  validate({ query: z.object({ m: z.string().min(1), sig: z.string().min(8) }) }),
  asyncHandler(async (req, res) => {
    const { m, sig } = req.query;
    const ok = sig === cardVerifyToken(m);
    if (!ok) return res.json({ valid: false, reason: "Bad signature — this code was not issued by AKDFA" });

    const member = await prisma.member.findUnique({
      where: { memberNumber: m },
      include: { district: { select: { name: true } }, unit: { select: { name: true } } },
    });
    if (!member) return res.json({ valid: false, reason: "No such member" });

    const active = member.status === "ACTIVE" && (!member.membershipExpiresAt || member.membershipExpiresAt > new Date());
    res.json({
      valid: active,
      reason: active ? null : `Membership ${member.status.toLowerCase()}`,
      member: {
        memberNumber: member.memberNumber,
        fullName: member.fullName,
        role: member.role,
        district: member.district.name,
        unit: member.unit.name,
        status: member.status,
        expiresAt: member.membershipExpiresAt,
      },
    });
  })
);

// Public numbers the website shows (so the join page can preview the fee without hard-coding it).
router.get("/config", (req, res) => res.json({ membershipFeeInr: Number(process.env.MEMBERSHIP_FEE_INR || 500) }));

// "Is this person a member?": type a membership number instead of scanning the card.
// Deliberately tells you very little (masked name, district, status) and is rate-limited so numbers can't be farmed.
const lookupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.LOOKUP_RATE_LIMIT_MAX || 20), message: { error: { message: "Too many lookups, try again later" } } });
router.get(
  "/members/lookup",
  lookupLimiter,
  validate({ query: z.object({ number: z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9-]+$/) }) }),
  asyncHandler(async (req, res) => {
    const member = await prisma.member.findUnique({
      where: { memberNumber: req.query.number.toUpperCase() },
      include: { district: { select: { name: true } } },
    });
    if (!member) return res.json({ found: false });
    const [first, ...rest] = String(member.fullName).split(" ");
    const active = member.status === "ACTIVE" && (!member.membershipExpiresAt || member.membershipExpiresAt > new Date());
    res.json({
      found: true,
      valid: active,
      membershipStatus: member.status,
      name: rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first,
      district: member.district.name,
      expiresAt: active ? member.membershipExpiresAt : null,
    });
  })
);

// Phase 0 — "A Contact page so anyone can reach us."
router.post(
  "/contact",
  validate({
    body: z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional(),
      subject: z.string().optional(),
      message: z.string().min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const message = await prisma.contactMessage.create({ data: req.body });
    res.status(201).json({ received: true, id: message.id });
  })
);

module.exports = router;
