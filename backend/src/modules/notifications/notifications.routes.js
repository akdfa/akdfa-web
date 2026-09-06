const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");

const router = Router();

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { memberId: req.auth.id },
      orderBy: { sentAt: "desc" },
      take: 100,
    });
    res.json({ notifications });
  })
);

router.patch(
  "/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { readAt: new Date() },
    });
    res.json({ notification });
  })
);

// Phase 4 — "Broadcast announcements: send urgent notices to every district, unit, and member at once."
router.post(
  "/broadcast",
  requireAuth,
  requireRole("STATE_ADMIN"),
  validate({
    body: z.object({
      title: z.string().min(2),
      body: z.string().min(1),
      category: z.string().default("ANNOUNCEMENT"),
      districtId: z.string().optional(), // omit = every district
    }),
  }),
  asyncHandler(async (req, res) => {
    const { title, body, category, districtId } = req.body;
    const members = await prisma.member.findMany({
      where: { districtId: districtId || undefined, status: "ACTIVE" },
      select: { id: true },
    });

    await prisma.notification.createMany({
      data: members.map((m) => ({ memberId: m.id, title, body, category, broadcastDistrictId: districtId })),
    });
    res.status(201).json({ sent: members.length });
  })
);

// Phase 2 — "Members choose what they want to be notified about, and how."
router.get(
  "/me/preferences",
  requireAuth,
  asyncHandler(async (req, res) => {
    const preferences = await prisma.notificationPreference.findMany({ where: { memberId: req.auth.id } });
    res.json({ preferences });
  })
);

router.put(
  "/me/preferences",
  requireAuth,
  validate({
    body: z.object({
      category: z.string().min(1),
      channel: z.enum(["EMAIL", "PUSH", "SMS"]),
      enabled: z.boolean(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { category, channel, enabled } = req.body;
    const preference = await prisma.notificationPreference.upsert({
      where: { memberId_category_channel: { memberId: req.auth.id, category, channel } },
      update: { enabled },
      create: { memberId: req.auth.id, category, channel, enabled },
    });
    res.json({ preference });
  })
);

module.exports = router;
