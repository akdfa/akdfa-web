const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { deleteUploadByUrl } = require("../../middleware/upload");

const { requireActive } = require("../../middleware/requireActive");
const { assertCanManage } = require("../../middleware/scope");

const router = Router();

const upsertSchema = z.object({
  title: z.string().min(2),
  type: z.enum(["TOURNAMENT", "CHARITY", "MATCH", "MEETING", "TRIAL", "OTHER"]),
  scope: z.enum(["STATE", "DISTRICT", "UNIT"]).default("DISTRICT"),
  districtId: z.string().optional(),
  unitId: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  photos: z.array(z.string().url()).optional(),
  bracket: z.any().optional(),
});


// ---- scope ---------------------------------------------------------------
// Events belong to a district and/or unit. Callers may only create/change events inside their own scope.
async function resolveTarget(auth, body) {
  if (body.scope === "STATE" && auth.role !== "STATE_ADMIN") throw ApiError.forbidden("Only the State Committee can create state-wide events");
  let { districtId, unitId } = body;
  if (auth.role !== "STATE_ADMIN") {
    if (auth.role === "UNIT_ADMIN") unitId = unitId || auth.unitId;
    districtId = districtId || (unitId ? undefined : auth.districtId); // with a unit, the district comes from that unit
  }
  if (unitId) {
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw ApiError.badRequest("Unknown unit");
    if (districtId && unit.districtId !== districtId) throw ApiError.badRequest("That unit is not in the chosen district");
    districtId = unit.districtId;
  }
  return { districtId, unitId };
}

async function loadManageable(req) {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) throw ApiError.notFound("Event not found");
  assertCanManage(req.auth, { districtId: event.districtId, unitId: event.unitId, ownerId: event.createdById });
  return event;
}

// Phase 1 — "a real calendar of tournaments, charity drives, and matches that people can filter by district."
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { districtId, type, from, to } = req.query;
    const events = await prisma.event.findMany({
      where: {
        status: "APPROVED",
        districtId: districtId || undefined,
        type: type || undefined,
        startsAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined },
      },
      orderBy: { startsAt: "asc" },
      include: {
        district: { select: { name: true } },
        _count: { select: { rsvps: true } },
      },
    });
    res.json({ events });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        rsvps: true,
        matches: { include: { homeTeam: true, awayTeam: true } },
        district: { select: { name: true } },
        charityReport: { include: { submittedBy: { select: { fullName: true } } } },
      },
    });
    if (!event) throw ApiError.notFound("Event not found");
    res.json({ event });
  })
);

router.post(
  "/",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({ body: upsertSchema }),
  asyncHandler(async (req, res) => {
    const target = await resolveTarget(req.auth, req.body);
    if (req.auth.role !== "STATE_ADMIN") assertCanManage(req.auth, target);
    const event = await prisma.event.create({
      data: { ...req.body, ...target, createdById: req.auth.id },
    });
    res.status(201).json({ event });
  })
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({ body: upsertSchema.partial() }),
  asyncHandler(async (req, res) => {
    await loadManageable(req);
    let data = req.body;
    if (data.scope || data.districtId || data.unitId) {
      // moving an event: the destination must be inside the caller's scope too
      const target = await resolveTarget(req.auth, data);
      if (req.auth.role !== "STATE_ADMIN") assertCanManage(req.auth, target);
      data = { ...data, ...target };
    }
    const event = await prisma.event.update({ where: { id: req.params.id }, data });
    res.json({ event });
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  asyncHandler(async (req, res) => {
    await loadManageable(req);
    const event = await prisma.event.delete({ where: { id: req.params.id } });
    (event.photos || []).forEach(deleteUploadByUrl);
    res.status(204).send();
  })
);

// Phase 3 — "submit ... photos" — append / replace an event's photo URLs.
router.patch(
  "/:id/photos",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({ body: z.object({ photos: z.array(z.string().url()) }) }),
  asyncHandler(async (req, res) => {
    await loadManageable(req);
    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: { photos: req.body.photos },
    });
    res.json({ event });
  })
);

// Phase 3 — "charity reports up to the state." Upsert the report for a CHARITY event.
router.get(
  "/:id/charity-report",
  asyncHandler(async (req, res) => {
    const report = await prisma.charityReport.findUnique({
      where: { eventId: req.params.id },
      include: { submittedBy: { select: { fullName: true } }, event: { select: { title: true, startsAt: true } } },
    });
    res.json({ report });
  })
);

router.put(
  "/:id/charity-report",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({
    body: z.object({
      peopleHelped: z.number().int().min(0).optional(),
      amountRaised: z.number().min(0).optional(),
      amountSpent: z.number().min(0).optional(),
      beneficiary: z.string().optional(),
      summary: z.string().optional(),
      photos: z.array(z.string().url()).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    await loadManageable(req);

    const report = await prisma.charityReport.upsert({
      where: { eventId: req.params.id },
      update: { ...req.body },
      create: { ...req.body, eventId: req.params.id, submittedById: req.auth.id },
    });
    res.status(201).json({ report });
  })
);

// Phase 2 — "RSVP to events."
router.post(
  "/:id/rsvp",
  requireAuth,
  requireActive,
  validate({ body: z.object({ status: z.enum(["GOING", "INTERESTED", "NOT_GOING"]).default("GOING") }) }),
  asyncHandler(async (req, res) => {
    const rsvp = await prisma.eventRsvp.upsert({
      where: { eventId_memberId: { eventId: req.params.id, memberId: req.auth.id } },
      update: { status: req.body.status },
      create: { eventId: req.params.id, memberId: req.auth.id, status: req.body.status },
    });
    res.status(201).json({ rsvp });
  })
);

module.exports = router;
