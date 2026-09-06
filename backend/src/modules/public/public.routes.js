const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const asyncHandler = require("../../utils/asyncHandler");
const { blindIndex } = require("../../utils/crypto");

const router = Router();

// Phase 1 — "a simple newsletter signup for people who aren't ready to join yet."
router.post(
  "/newsletter",
  validate({ body: z.object({ email: z.string().email() }) }),
  asyncHandler(async (req, res) => {
    const subscriber = await prisma.newsletterSubscriber.upsert({
      where: { emailHash: blindIndex(req.body.email) },
      update: { unsubscribedAt: null },
      create: { email: req.body.email },
    });
    res.status(201).json({ subscriber: { id: subscriber.id, subscribedAt: subscriber.subscribedAt } });
  })
);

router.post(
  "/newsletter/unsubscribe",
  validate({ body: z.object({ email: z.string().email() }) }),
  asyncHandler(async (req, res) => {
    await prisma.newsletterSubscriber.updateMany({
      where: { emailHash: blindIndex(req.body.email) },
      data: { unsubscribedAt: new Date() },
    });
    res.status(204).send();
  })
);

// Phase 0 — "A Contact page so anyone can reach us."
router.post(
  "/contact",
  validate({
    body: z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional(),
      subject: z.string().optional(),
      message: z.string().min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const message = await prisma.contactMessage.create({ data: req.body });
    res.status(201).json({ received: true, id: message.id });
  })
);

module.exports = router;
