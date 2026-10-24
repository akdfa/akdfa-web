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

const createSchema = z.object({
  districtId: z.string().min(1),
  name: z.string().min(2),
  address: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
});

// Public — the "directory of all 17 units" from Phase 0.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { districtId, status } = req.query;
    const statusFilter = !status ? "APPROVED" : status === "ALL" ? undefined : status;
    const units = await prisma.unit.findMany({
      where: {
        districtId: districtId || undefined,
        status: statusFilter,
      },
      orderBy: { name: "asc" },
    });
    res.json({ units });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const unit = await prisma.unit.findUnique({
      where: { id: req.params.id },
      include: { district: true, teams: true },
    });
    if (!unit) throw ApiError.notFound("Unit not found");
    res.json({ unit });
  })
);

// Units are managed by the State Committee only: they add units (approved straight away) and delete them.
router.post(
  "/",
  requireAuth,
  requireRole("STATE_ADMIN"),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const district = await prisma.district.findUnique({ where: { id: req.body.districtId } });
    if (!district) throw ApiError.badRequest("Unknown district");
    const unit = await prisma.unit.create({ data: { ...req.body, status: "APPROVED", approvedById: req.auth.id } });
    await logAudit(req.auth.id, "UNIT_CREATED", "Unit", unit.id, { districtId: unit.districtId, name: unit.name });
    res.status(201).json({ unit });
  })
);

// A unit that still has members cannot be deleted (move or remove the members first); its teams go with it.
router.delete(
  "/:id",
  requireAuth,
  requireRole("STATE_ADMIN"),
  asyncHandler(async (req, res) => {
    const unit = await prisma.unit.findUnique({ where: { id: req.params.id }, include: { _count: { select: { members: true } } } });
    if (!unit) throw ApiError.notFound("Unit not found");
    if (unit._count.members > 0) {
      throw ApiError.conflict(`${unit.name} still has ${unit._count.members} member${unit._count.members === 1 ? "" : "s"}. Move or remove them before deleting the unit.`);
    }
    await prisma.unit.delete({ where: { id: unit.id } });
    await logAudit(req.auth.id, "UNIT_DELETED", "Unit", unit.id, { name: unit.name, districtId: unit.districtId });
    res.status(204).send();
  })
);

module.exports = router;
