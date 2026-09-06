const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { notify } = require("../notifications/notify.service");

const router = Router();

// Phase 2 — "send feedback straight to your unit leaders."
// A member's feedback goes to their unit; unit/district admins triage it.

router.post(
  "/",
  requireAuth,
  validate({ body: z.object({ subject: z.string().min(2), message: z.string().min(2) }) }),
  asyncHandler(async (req, res) => {
    const feedback = await prisma.feedback.create({
      data: {
        authorId: req.auth.id,
        unitId: req.auth.unitId,
        districtId: req.auth.districtId,
        subject: req.body.subject,
        message: req.body.message,
      },
    });

    // Notify the unit's admins so it doesn't sit unseen.
    const admins = await prisma.member.findMany({
      where: { unitId: req.auth.unitId, role: { in: ["UNIT_ADMIN", "DISTRICT_ADMIN", "STATE_ADMIN"] }, status: "ACTIVE" },
      select: { id: true },
    });
    await notify(
      admins.map((a) => a.id),
      {
        title: "New member feedback",
        body: "A member sent feedback to your unit. Open the Feedback inbox to read it.",
        category: "FEEDBACK",
        force: true,
      }
    );

    res.status(201).json({ feedback });
  })
);

// The member's own thread(s).
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const feedback = await prisma.feedback.findMany({
      where: { authorId: req.auth.id },
      orderBy: { createdAt: "desc" },
      include: { handledBy: { select: { fullName: true } } },
    });
    res.json({ feedback });
  })
);

// Admin inbox — scoped to what the admin oversees.
router.get(
  "/",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  asyncHandler(async (req, res) => {
    let where = {};
    if (req.auth.role === "UNIT_ADMIN") where = { unitId: req.auth.unitId };
    else if (req.auth.role === "DISTRICT_ADMIN") where = { districtId: req.auth.districtId };
    if (req.query.status) where.status = req.query.status;

    const feedback = await prisma.feedback.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        author: { select: { fullName: true, memberNumber: true } },
        unit: { select: { name: true } },
        handledBy: { select: { fullName: true } },
      },
    });
    res.json({ feedback });
  })
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({
    body: z.object({
      status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]).optional(),
      response: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.feedback.findUnique({ where: { id: req.params.id } });
    if (!existing) throw ApiError.notFound("Feedback not found");
    if (req.auth.role === "UNIT_ADMIN" && existing.unitId !== req.auth.unitId) throw ApiError.forbidden();
    if (req.auth.role === "DISTRICT_ADMIN" && existing.districtId !== req.auth.districtId) throw ApiError.forbidden();

    const feedback = await prisma.feedback.update({
      where: { id: req.params.id },
      data: { ...req.body, handledById: req.auth.id },
    });

    // Let the member know when their unit responds.
    if (req.body.response) {
      await notify(existing.authorId, {
        title: "Your unit replied to your feedback",
        body: "Open Feedback in your portal to read the reply.",
        category: "FEEDBACK",
        force: true,
      });
    }
    res.json({ feedback });
  })
);

module.exports = router;
