const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { logAudit } = require("../admin/audit.service");

const router = Router();

const PLATFORMS = ["facebook", "instagram", "x", "youtube", "whatsapp", "telegram", "linkedin", "website"];
const httpUrl = z.string().trim().url().max(500).refine((u) => /^https?:\/\//i.test(u), "URL must start with http:// or https://");
const createSchema = z.object({ platform: z.enum(PLATFORMS), url: httpUrl, label: z.string().trim().max(60).optional() });

// Public: the profiles the State Committee has added, shown on the home page and Contact page.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const links = await prisma.socialLink.findMany({ orderBy: { createdAt: "asc" } });
    res.json({ links });
  })
);

router.post(
  "/",
  requireAuth,
  requireRole("STATE_ADMIN"),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const link = await prisma.socialLink.create({ data: req.body });
    await logAudit(req.auth.id, "SOCIAL_LINK_CREATED", "SocialLink", link.id, { platform: link.platform });
    res.status(201).json({ link });
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("STATE_ADMIN"),
  asyncHandler(async (req, res) => {
    const link = await prisma.socialLink.findUnique({ where: { id: req.params.id } });
    if (!link) throw ApiError.notFound("Social link not found");
    await prisma.socialLink.delete({ where: { id: link.id } });
    await logAudit(req.auth.id, "SOCIAL_LINK_DELETED", "SocialLink", link.id, { platform: link.platform });
    res.status(204).send();
  })
);

module.exports = router;
