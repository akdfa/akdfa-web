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
  name: z.string().min(2),
  code: z.string().min(2).max(6),
  region: z.string().optional(),
  bio: z.string().optional(),
  bannerUrl: z.string().url().optional(),
});

// Public — powers the "districts, brought to life" directory (Phase 1).
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const districts = await prisma.district.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { units: true, members: true } } },
    });
    res.json({ districts });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const district = await prisma.district.findUnique({
      where: { id: req.params.id },
      include: { units: true },
    });
    if (!district) throw ApiError.notFound("District not found");
    res.json({ district });
  })
);

// Only the State Committee creates/edits districts (Phase 4 oversight).
router.post(
  "/",
  requireAuth,
  requireRole("STATE_ADMIN"),
  validate({ body: upsertSchema }),
  asyncHandler(async (req, res) => {
    const district = await prisma.district.create({ data: req.body });
    res.status(201).json({ district });
  })
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("STATE_ADMIN"),
  validate({ body: upsertSchema.partial() }),
  asyncHandler(async (req, res) => {
    const district = await prisma.district.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ district });
  })
);

module.exports = router;
