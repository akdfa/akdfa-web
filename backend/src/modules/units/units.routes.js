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

// Phase 3 — "Manage local units: Add and approve local clubs within their district."
// Any authenticated member can propose a new unit; it lands PENDING for a district admin.
router.post(
  "/",
  requireAuth,
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const unit = await prisma.unit.create({ data: req.body });
    res.status(201).json({ unit });
  })
);

router.post(
  "/:id/approve",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  asyncHandler(async (req, res) => {
    const unit = await prisma.unit.update({
      where: { id: req.params.id },
      data: { status: "APPROVED", approvedById: req.auth.id },
    });
    await logAudit(req.auth.id, "UNIT_APPROVED", "Unit", unit.id);
    res.json({ unit });
  })
);

module.exports = router;
