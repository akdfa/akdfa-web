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
      include: { units: { where: { status: "APPROVED" }, select: { id: true, name: true } } },
    });
    if (!district) throw ApiError.notFound("District not found");
    res.json({ district });
  })
);

// Phase 1 — "Districts, brought to life": the public showcase for one district —
// its story, upcoming events, recent results, and charity impact.
router.get(
  "/:id/showcase",
  asyncHandler(async (req, res) => {
    const district = await prisma.district.findUnique({
      where: { id: req.params.id },
      include: {
        units: { where: { status: "APPROVED" }, select: { id: true, name: true } },
        _count: { select: { members: true, units: true } },
      },
    });
    if (!district) throw ApiError.notFound("District not found");

    const now = new Date();
    const [upcomingEvents, pastEvents, recentMatches, charity] = await Promise.all([
      prisma.event.findMany({
        where: { districtId: district.id, status: "APPROVED", startsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
        take: 6,
        select: { id: true, title: true, type: true, startsAt: true, location: true },
      }),
      prisma.event.findMany({
        where: { districtId: district.id, status: "APPROVED", startsAt: { lt: now } },
        orderBy: { startsAt: "desc" },
        take: 4,
        select: { id: true, title: true, type: true, startsAt: true, photos: true },
      }),
      prisma.match.findMany({
        where: {
          status: "COMPLETED",
          OR: [
            { homeTeam: { unit: { districtId: district.id } } },
            { awayTeam: { unit: { districtId: district.id } } },
          ],
        },
        orderBy: { scheduledAt: "desc" },
        take: 5,
        include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
      }),
      prisma.charityReport.findMany({
        where: { event: { districtId: district.id } },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: { event: { select: { title: true, startsAt: true } } },
      }),
    ]);

    res.json({ district, upcomingEvents, pastEvents, recentMatches, charity });
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
