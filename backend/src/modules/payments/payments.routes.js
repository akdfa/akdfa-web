const { Router } = require("express");
const { z } = require("zod");
const crypto = require("crypto");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { requireRole, RANK } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { getRazorpayClient } = require("../../config/razorpay");
const env = require("../../config/env");
const { membershipReceiptHtml, sponsorInvoiceHtml, invoiceNumber } = require("../../utils/receipts");
const { notify } = require("../notifications/notify.service");

const router = Router();
const MEMBERSHIP_FEE_INR = Number(process.env.MEMBERSHIP_FEE_INR || 500);

function verifySignature(orderId, paymentId, signature) {
  if (!env.razorpay.keySecret) throw new ApiError(503, "Payments are not configured yet");
  const expected = crypto
    .createHmac("sha256", env.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}

// Mark a paid gateway order across every payment type + issue receipts/invoices.
async function settleGatewayOrder(orderId) {
  const fee = await prisma.membershipFee.findFirst({ where: { gatewayRef: orderId } });
  if (fee && fee.status !== "SUCCESS") {
    await prisma.$transaction([
      prisma.membershipFee.update({
        where: { id: fee.id },
        data: {
          status: "SUCCESS",
          paidAt: new Date(),
          receiptUrl: `${env.publicBaseUrl}/api/v1/payments/membership-fees/${fee.id}/receipt`,
        },
      }),
      // Paying never activates someone who hasn't been approved (or was rejected /
      // suspended) — only an existing ACTIVE or LAPSED member is (re)activated.
      prisma.member.updateMany({
        where: { id: fee.memberId, status: { in: ["ACTIVE", "LAPSED"] } },
        data: {
          status: "ACTIVE",
          membershipExpiresAt: new Date(fee.period + 1, 2, 31),
          renewalReminderAt: null,
        },
      }),
    ]);
    await notify(fee.memberId, {
      title: "Membership fee received",
      body: `Your ${fee.period} membership is paid. Download your receipt from Membership Fee.`,
      category: "PAYMENT",
      force: true,
    });
  }

  await prisma.order.updateMany({ where: { gatewayRef: orderId, status: "PENDING" }, data: { status: "PAID" } });

  const sp = await prisma.sponsorPayment.findFirst({ where: { gatewayRef: orderId } });
  if (sp && sp.status !== "SUCCESS") {
    const count = await prisma.sponsorPayment.count({ where: { invoiceNumber: { not: null } } });
    const invNo = invoiceNumber(count + 1);
    await prisma.sponsorPayment.update({
      where: { id: sp.id },
      data: {
        status: "SUCCESS",
        paidAt: new Date(),
        invoiceNumber: invNo,
        invoiceUrl: `${env.publicBaseUrl}/api/v1/payments/sponsor-payments/${sp.id}/invoice`,
      },
    });
  }
}

/* ---- membership fees --------------------------------------------------- */

router.post(
  "/membership-fees/:period/checkout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const period = Number(req.params.period);
    const razorpay = getRazorpayClient();
    if (!razorpay) throw new ApiError(503, "Payments are not configured yet");

    const amount = MEMBERSHIP_FEE_INR * 100;
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

// Downloadable receipt (HTML → the browser saves as PDF).
router.get(
  "/membership-fees/:id/receipt",
  requireAuth,
  asyncHandler(async (req, res) => {
    const fee = await prisma.membershipFee.findUnique({ where: { id: req.params.id } });
    if (!fee) throw ApiError.notFound("Payment not found");
    if (fee.memberId !== req.auth.id && RANK[req.auth.role] < 2) throw ApiError.forbidden();
    if (fee.status !== "SUCCESS") throw ApiError.badRequest("No receipt until the payment succeeds");
    const member = await prisma.member.findUnique({
      where: { id: fee.memberId },
      include: { district: { select: { name: true } }, unit: { select: { name: true } } },
    });
    res.type("html").send(membershipReceiptHtml(fee, member));
  })
);

/* ---- browser payment confirmation ----------------------------------- */

router.post(
  "/verify",
  requireAuth,
  validate({
    body: z.object({
      razorpay_order_id: z.string(),
      razorpay_payment_id: z.string(),
      razorpay_signature: z.string(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      throw ApiError.badRequest("Payment signature mismatch");
    }
    await settleGatewayOrder(razorpay_order_id);
    res.json({ verified: true });
  })
);

/* ---- Razorpay webhook --------------------------------------------------- */

router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    if (!env.razorpay.webhookSecret) throw new ApiError(503, "Webhook secret not configured");
    const signature = req.headers["x-razorpay-signature"];
    const payload = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));
    const expected = crypto.createHmac("sha256", env.razorpay.webhookSecret).update(payload).digest("hex");
    if (signature !== expected) throw ApiError.unauthorized("Invalid webhook signature");

    const event = req.body;
    if (event.event === "payment.captured" || event.event === "order.paid") {
      const orderId = event.payload.payment?.entity?.order_id || event.payload.order?.entity?.id;
      if (orderId) await settleGatewayOrder(orderId);
    }
    res.status(200).json({ received: true });
  })
);

/* ---- sponsor payments ------------------------------------------------- */

// Staff raise a payment request for a sponsor and get a shareable link.
router.post(
  "/sponsors/:sponsorId/request",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  validate({ body: z.object({ amount: z.number().positive(), note: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const sponsor = await prisma.sponsor.findUnique({ where: { id: req.params.sponsorId } });
    if (!sponsor) throw ApiError.notFound("Sponsor not found");
    const payToken = crypto.randomBytes(20).toString("hex");
    const payment = await prisma.sponsorPayment.create({
      data: { sponsorId: sponsor.id, amount: req.body.amount, note: req.body.note, payToken },
    });
    res.status(201).json({
      payment: { id: payment.id, amount: payment.amount, note: payment.note },
      payUrl: `${env.publicBaseUrl}/sponsor-pay.html?token=${payToken}`,
    });
  })
);

// Immediate staff-initiated checkout (kept for convenience).
router.post(
  "/sponsors/:sponsorId/checkout",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  validate({ body: z.object({ amount: z.number().positive(), note: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const razorpay = getRazorpayClient();
    if (!razorpay) throw new ApiError(503, "Payments are not configured yet");
    const order = await razorpay.orders.create({
      amount: Math.round(req.body.amount * 100),
      currency: "INR",
      receipt: `sponsor-${req.params.sponsorId}-${Date.now()}`,
    });
    await prisma.sponsorPayment.create({
      data: { sponsorId: req.params.sponsorId, amount: req.body.amount, note: req.body.note, gatewayRef: order.id },
    });
    res.json({ orderId: order.id, amount: order.amount, currency: "INR", keyId: env.razorpay.keyId });
  })
);

router.get(
  "/sponsors/payments",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  asyncHandler(async (req, res) => {
    const payments = await prisma.sponsorPayment.findMany({
      orderBy: { createdAt: "desc" },
      include: { sponsor: { select: { name: true } } },
    });
    res.json({ payments });
  })
);

// Public: a sponsor loads their pay link, pays, and gets an invoice.
router.get(
  "/sponsor-payments/by-token/:token",
  asyncHandler(async (req, res) => {
    const payment = await prisma.sponsorPayment.findUnique({
      where: { payToken: req.params.token },
      include: { sponsor: { select: { name: true } } },
    });
    if (!payment) throw ApiError.notFound("Payment link not found");
    res.json({
      payment: {
        id: payment.id,
        amount: payment.amount,
        note: payment.note,
        status: payment.status,
        sponsorName: payment.sponsor.name,
        invoiceUrl: payment.status === "SUCCESS" ? payment.invoiceUrl : null,
      },
    });
  })
);

router.post(
  "/sponsor-payments/by-token/:token/checkout",
  asyncHandler(async (req, res) => {
    const razorpay = getRazorpayClient();
    if (!razorpay) throw new ApiError(503, "Payments are not configured yet");
    const payment = await prisma.sponsorPayment.findUnique({ where: { payToken: req.params.token } });
    if (!payment) throw ApiError.notFound("Payment link not found");
    if (payment.status === "SUCCESS") throw ApiError.badRequest("This payment is already complete");

    const order = await razorpay.orders.create({
      amount: Math.round(Number(payment.amount) * 100),
      currency: "INR",
      receipt: `sponsor-${payment.id}`,
    });
    await prisma.sponsorPayment.update({ where: { id: payment.id }, data: { gatewayRef: order.id } });
    res.json({ orderId: order.id, amount: order.amount, currency: "INR", keyId: env.razorpay.keyId });
  })
);

router.post(
  "/sponsor-payments/by-token/:token/verify",
  validate({
    body: z.object({
      razorpay_order_id: z.string(),
      razorpay_payment_id: z.string(),
      razorpay_signature: z.string(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const payment = await prisma.sponsorPayment.findUnique({ where: { payToken: req.params.token } });
    if (!payment) throw ApiError.notFound("Payment link not found");
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (payment.gatewayRef !== razorpay_order_id) throw ApiError.badRequest("Order mismatch");
    if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      throw ApiError.badRequest("Payment signature mismatch");
    }
    await settleGatewayOrder(razorpay_order_id);
    const updated = await prisma.sponsorPayment.findUnique({ where: { id: payment.id } });
    res.json({ verified: true, invoiceUrl: updated.invoiceUrl });
  })
);

router.get(
  "/sponsor-payments/:id/invoice",
  asyncHandler(async (req, res) => {
    const payment = await prisma.sponsorPayment.findUnique({
      where: { id: req.params.id },
      include: { sponsor: true },
    });
    if (!payment || payment.status !== "SUCCESS") throw ApiError.notFound("Invoice not available");
    res.type("html").send(sponsorInvoiceHtml(payment, payment.sponsor));
  })
);

module.exports = router;
