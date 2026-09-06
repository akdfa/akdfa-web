const { Router } = require("express");
const { z } = require("zod");
const crypto = require("crypto");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { getRazorpayClient } = require("../../config/razorpay");
const env = require("../../config/env");

const router = Router();
const MEMBERSHIP_FEE_INR = Number(process.env.MEMBERSHIP_FEE_INR || 500); // adjust per the Committee's approved fee

// The Razorpay dashboard webhook is the source of truth in production, but it
// can't reach localhost during development — so the browser checkout handler
// posts the success payload here and we verify it with the key secret.
const verifySchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

router.post(
  "/verify",
  requireAuth,
  validate({ body: verifySchema }),
  asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!env.razorpay.keySecret) throw new ApiError(503, "Payments are not configured yet");

    const expected = crypto
      .createHmac("sha256", env.razorpay.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature) throw ApiError.badRequest("Payment signature mismatch");

    const fee = await prisma.membershipFee.findFirst({ where: { gatewayRef: razorpay_order_id } });
    if (fee) {
      await prisma.$transaction([
        prisma.membershipFee.update({
          where: { id: fee.id },
          data: { status: "SUCCESS", paidAt: new Date() },
        }),
        prisma.member.update({
          where: { id: fee.memberId },
          data: { status: "ACTIVE", membershipExpiresAt: new Date(fee.period + 1, 2, 31) },
        }),
      ]);
    }
    await prisma.order.updateMany({ where: { gatewayRef: razorpay_order_id }, data: { status: "PAID" } });
    await prisma.sponsorPayment.updateMany({
      where: { gatewayRef: razorpay_order_id },
      data: { status: "SUCCESS" },
    });

    res.json({ verified: true });
  })
);

// Phase 5 — "Members pay their yearly fee right in the app."
router.post(
  "/membership-fees/:period/checkout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const period = Number(req.params.period);
    const razorpay = getRazorpayClient();
    if (!razorpay) throw new ApiError(503, "Payments are not configured yet");

    const amount = MEMBERSHIP_FEE_INR * 100; // paise
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `membership-${req.auth.id}-${period}`,
    });

    await prisma.membershipFee.upsert({
      where: { memberId_period: { memberId: req.auth.id, period } },
      update: { gatewayRef: order.id, amount: MEMBERSHIP_FEE_INR, status: "PENDING" },
      create: { memberId: req.auth.id, period, amount: MEMBERSHIP_FEE_INR, gatewayRef: order.id },
    });

    res.json({ orderId: order.id, amount, currency: "INR", keyId: env.razorpay.keyId });
  })
);

router.get(
  "/membership-fees/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const fees = await prisma.membershipFee.findMany({
      where: { memberId: req.auth.id },
      orderBy: { period: "desc" },
    });
    res.json({ fees });
  })
);

// Razorpay webhook — verifies the signature, then marks the fee/order paid.
// Configure this URL in the Razorpay dashboard; set RAZORPAY_WEBHOOK_SECRET in .env.
router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    if (!env.razorpay.webhookSecret) throw new ApiError(503, "Webhook secret not configured");

    const signature = req.headers["x-razorpay-signature"];
    // Verify against the exact bytes received (captured in app.js as req.rawBody).
    const payload = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));
    const expected = crypto
      .createHmac("sha256", env.razorpay.webhookSecret)
      .update(payload)
      .digest("hex");

    if (signature !== expected) throw ApiError.unauthorized("Invalid webhook signature");

    const event = req.body;
    if (event.event === "payment.captured" || event.event === "order.paid") {
      const orderId = event.payload.payment?.entity?.order_id || event.payload.order?.entity?.id;
      const [fees] = await Promise.all([
        prisma.membershipFee.updateMany({
          where: { gatewayRef: orderId },
          data: { status: "SUCCESS", paidAt: new Date() },
        }),
        prisma.order.updateMany({ where: { gatewayRef: orderId }, data: { status: "PAID" } }),
        prisma.sponsorPayment.updateMany({ where: { gatewayRef: orderId }, data: { status: "SUCCESS" } }),
      ]);
      // Push the member's membership expiry out a year on a successful fee payment.
      if (fees.count) {
        const paid = await prisma.membershipFee.findFirst({ where: { gatewayRef: orderId } });
        if (paid) {
          await prisma.member.update({
            where: { id: paid.memberId },
            data: { status: "ACTIVE", membershipExpiresAt: new Date(paid.period + 1, 2, 31) },
          });
        }
      }
    }

    res.status(200).json({ received: true });
  })
);

// Phase 5 — "Sponsors can pay and receive an invoice through the same trusted system."
router.post(
  "/sponsors/:sponsorId/checkout",
  requireAuth,
  validate({ body: z.object({ amount: z.number().positive() }) }),
  asyncHandler(async (req, res) => {
    const razorpay = getRazorpayClient();
    if (!razorpay) throw new ApiError(503, "Payments are not configured yet");

    const order = await razorpay.orders.create({
      amount: Math.round(req.body.amount * 100),
      currency: "INR",
      receipt: `sponsor-${req.params.sponsorId}-${Date.now()}`,
    });

    await prisma.sponsorPayment.create({
      data: { sponsorId: req.params.sponsorId, amount: req.body.amount, gatewayRef: order.id },
    });

    res.json({ orderId: order.id, amount: order.amount, currency: "INR", keyId: env.razorpay.keyId });
  })
);

module.exports = router;
