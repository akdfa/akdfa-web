const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");
const { notify } = require("./notify.service");

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
// Phase 4 — State broadcasts to everyone / one district.
// Phase 3 — "send announcements ... to their own district only": a DISTRICT_ADMIN
// may broadcast, but only ever to their own district.
router.post(
  "/broadcast",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  validate({
    body: z.object({
      title: z.string().min(2),
      body: z.string().min(1),
      category: z.string().default("ANNOUNCEMENT"),
      districtId: z.string().optional(), // omit = every district (state only)
    }),
  }),
  asyncHandler(async (req, res) => {
    const { title, body, category } = req.body;
    const districtId = req.auth.role === "STATE_ADMIN" ? req.body.districtId : req.auth.districtId;

    const members = await prisma.member.findMany({
      where: { districtId: districtId || undefined, status: "ACTIVE" },
      select: { id: true },
    });

    // Urgent circulars (ANNOUNCEMENT) always land; NEWS/EVENT-tagged broadcasts
    // respect the member's notification preferences.
    const sent = await notify(
      members.map((m) => m.id),
      { title, body, category, broadcastDistrictId: districtId, force: category === "ANNOUNCEMENT" }
    );
    res.status(201).json({ sent, scope: districtId ? "district" : "state" });
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
