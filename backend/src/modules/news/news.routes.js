const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");

const router = Router();

const upsertSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(1),
  coverImageUrl: z.string().url().optional(),
  scope: z.enum(["STATE", "DISTRICT", "UNIT"]).default("STATE"),
  districtId: z.string().optional(),
  publishNow: z.boolean().optional(),
});

// Phase 2 — "one place to see everything: state announcements mixed with news from your own district."
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { districtId, scope } = req.query;
    const posts = await prisma.newsPost.findMany({
      where: {
        publishedAt: { not: null },
        scope: scope || undefined,
        OR: districtId ? [{ scope: "STATE" }, { districtId }] : undefined,
      },
      orderBy: { publishedAt: "desc" },
      include: { author: { select: { fullName: true } }, district: { select: { name: true } } },
    });
    res.json({ posts });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const post = await prisma.newsPost.findUnique({ where: { id: req.params.id } });
    if (!post) throw ApiError.notFound("Post not found");
    res.json({ post });
  })
);

// Unit admins post to their unit/district feed; state admins post state-wide (Phase 4 broadcasts).
router.post(
  "/",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({ body: upsertSchema }),
  asyncHandler(async (req, res) => {
    const { publishNow, ...data } = req.body;
    if (data.scope !== "STATE" && !data.districtId) data.districtId = req.auth.districtId;
    if (data.scope === "STATE" && req.auth.role !== "STATE_ADMIN") {
      throw ApiError.forbidden("Only the State Committee can post state-wide news");
    }

    const post = await prisma.newsPost.create({
      data: { ...data, authorId: req.auth.id, publishedAt: publishNow ? new Date() : null },
    });
    res.status(201).json({ post });
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  asyncHandler(async (req, res) => {
    const post = await prisma.newsPost.delete({ where: { id: req.params.id } });
    require("../../middleware/upload").deleteUploadByUrl(post.coverImageUrl);
    res.status(204).send();
  })
);

module.exports = router;
