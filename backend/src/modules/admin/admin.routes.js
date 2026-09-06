const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");

const router = Router();

// Phase 4 — "store official documents: bylaws, meeting minutes, circulars in one safe place."

router.get(
  "/documents",
  requireAuth,
  asyncHandler(async (req, res) => {
    const where =
      req.auth.role === "STATE_ADMIN"
        ? {}
        : { OR: [{ visibility: "PUBLIC" }, { districtId: req.auth.districtId }] };
    const documents = await prisma.document.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json({ documents });
  })
);

router.post(
  "/documents",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  validate({
    body: z.object({
      title: z.string().min(2),
      type: z.enum(["BYLAW", "MINUTES", "CIRCULAR", "OTHER"]),
      fileUrl: z.string().url(),
      visibility: z.enum(["PUBLIC", "STATE_ONLY", "DISTRICT_ONLY"]).default("DISTRICT_ONLY"),
      districtId: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const districtId = req.auth.role === "STATE_ADMIN" ? req.body.districtId : req.auth.districtId;
    const document = await prisma.document.create({
      data: { ...req.body, districtId, uploadedById: req.auth.id },
    });
    res.status(201).json({ document });
  })
);

router.delete(
  "/documents/:id",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  asyncHandler(async (req, res) => {
    await prisma.document.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

// Phase 4 — audit trail read access, State Committee only.
router.get(
  "/audit-logs",
  requireAuth,
  requireRole("STATE_ADMIN"),
  asyncHandler(async (req, res) => {
    const { entityType, entityId } = req.query;
    const logs = await prisma.auditLog.findMany({
      where: { entityType: entityType || undefined, entityId: entityId || undefined },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { actor: { select: { fullName: true, role: true } } },
    });
    res.json({ logs });
  })
);

module.exports = router;
