const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth, attachAuthIfPresent } = require("../../middleware/auth");
const { requireRole, RANK } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { assertCanManage } = require("../../middleware/scope");

const router = Router();

// A sponsor with no district is a state-level partner: only the State Committee manages those.
async function loadManageableSponsor(req) {
  const sponsor = await prisma.sponsor.findUnique({ where: { id: req.params.id } });
  if (!sponsor) throw ApiError.notFound("Sponsor not found");
  assertCanManage(req.auth, { districtId: sponsor.districtId }, "You can only manage sponsors in your own district");
  return sponsor;
}

// Phase 1 — "showing our sponsors publicly." District/State admins can pass
// ?scope=all to also see non-public sponsor records they manage.
router.get(
  "/",
  attachAuthIfPresent,
  asyncHandler(async (req, res) => {
    const isAdmin = req.auth && RANK[req.auth.role] >= 2;
    const where = req.query.scope === "all" && isAdmin ? {} : { isPublic: true };
    const sponsors = await prisma.sponsor.findMany({
      where,
      orderBy: [{ tier: "asc" }, { name: "asc" }],
      include: { _count: { select: { payments: true } } },
    });
    res.json({ sponsors });
  })
);

// Phase 1 — "a simple way for new sponsors to get in touch" lands here as a lead;
// a state/district admin promotes it to a full Sponsor record after contact.
router.post(
  "/leads",
  validate({
    body: z.object({
      name: z.string().min(2),
      contactName: z.string().optional(),
      contactEmail: z.string().email(),
      contactPhone: z.string().optional(),
      message: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { message, ...rest } = req.body;
    await prisma.contactMessage.create({
      data: { name: rest.contactName || rest.name, email: rest.contactEmail, phone: rest.contactPhone, subject: "Sponsorship inquiry", message: message || `Interested sponsor: ${rest.name}` },
    });
    res.status(201).json({ received: true });
  })
);

router.post(
  "/",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  validate({
    body: z.object({
      name: z.string().min(2),
      logoUrl: z.string().url().optional(),
      tier: z.enum(["PLATINUM", "GOLD", "SILVER", "BRONZE", "COMMUNITY"]).default("COMMUNITY"),
      districtId: z.string().optional(), // omit = state-level
      contactName: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      website: z.string().url().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    // Omitting districtId means "state-level" for the State Committee; district admins always add to their own district.
    const districtId = req.auth.role === "STATE_ADMIN" ? req.body.districtId : req.body.districtId || req.auth.districtId;
    assertCanManage(req.auth, { districtId }, "You can only add sponsors in your own district");
    const sponsor = await prisma.sponsor.create({ data: { ...req.body, districtId } });
    res.status(201).json({ sponsor });
  })
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  validate({
    body: z.object({
      name: z.string().min(2).optional(),
      logoUrl: z.string().url().optional(),
      tier: z.enum(["PLATINUM", "GOLD", "SILVER", "BRONZE", "COMMUNITY"]).optional(),
      districtId: z.string().nullable().optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      website: z.string().url().optional(),
      isPublic: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    await loadManageableSponsor(req);
    if ("districtId" in req.body) assertCanManage(req.auth, { districtId: req.body.districtId }, "You can only move sponsors within your own district");
    const sponsor = await prisma.sponsor.update({ where: { id: req.params.id }, data: req.body });
    res.json({ sponsor });
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  asyncHandler(async (req, res) => {
    await loadManageableSponsor(req);
    await prisma.sponsor.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

// Phase 3 — "Track local sponsorships: a simple way to log local sponsor support and small expenses."
router.get(
  "/districts/:districtId/logs",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  asyncHandler(async (req, res) => {
    assertCanManage(req.auth, { districtId: req.params.districtId }, "You can only see your own district's sponsorship log");
    const logs = await prisma.sponsorshipLog.findMany({
      where: { districtId: req.params.districtId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ logs });
  })
);

router.post(
  "/districts/:districtId/logs",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  validate({
    body: z.object({
      sponsorName: z.string().min(1),
      amount: z.number().positive(),
      type: z.enum(["INCOME", "EXPENSE"]),
      notes: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    assertCanManage(req.auth, { districtId: req.params.districtId }, "You can only log sponsorship in your own district");
    const log = await prisma.sponsorshipLog.create({
      data: { ...req.body, districtId: req.params.districtId, loggedById: req.auth.id },
    });
    res.status(201).json({ log });
  })
);

module.exports = router;
