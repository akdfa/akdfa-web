const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth, attachAuthIfPresent } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { getRazorpayClient } = require("../../config/razorpay");
const env = require("../../config/env");

const router = Router();

// Phase 5 — "The AKDFA Store: official jerseys, caps, and scarves ... with a special member price."
router.get(
  "/products",
  attachAuthIfPresent,
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({ where: { isActive: true } });
    const isMember = Boolean(req.auth);
    res.json({
      products: products.map((p) => ({
        ...p,
        displayPrice: isMember ? p.memberPrice : p.price,
      })),
    });
  })
);

router.post(
  "/products",
  requireAuth,
  requireRole("STATE_ADMIN"),
  validate({
    body: z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      category: z.string(),
      price: z.number().positive(),
      memberPrice: z.number().positive(),
      imageUrl: z.string().url().optional(),
      sizesAvailable: z.array(z.string()).default([]),
      stock: z.number().int().min(0).default(0),
    }),
  }),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.create({ data: req.body });
    res.status(201).json({ product });
  })
);

const orderItemSchema = z.object({ productId: z.string(), size: z.string().optional(), quantity: z.number().int().positive() });

router.post(
  "/orders",
  requireAuth,
  validate({ body: z.object({ items: z.array(orderItemSchema).min(1), shippingAddress: z.string().min(5) }) }),
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      where: { id: { in: req.body.items.map((i) => i.productId) } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let totalAmount = 0;
    const items = req.body.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw ApiError.badRequest(`Unknown product ${item.productId}`);
      if (product.stock < item.quantity) throw ApiError.badRequest(`${product.name} is out of stock`);
      const unitPrice = Number(product.memberPrice);
      totalAmount += unitPrice * item.quantity;
      return { productId: product.id, size: item.size, quantity: item.quantity, unitPrice };
    });

    const razorpay = getRazorpayClient();
    let gatewayRef;
    if (razorpay) {
      const gwOrder = await razorpay.orders.create({ amount: Math.round(totalAmount * 100), currency: "INR" });
      gatewayRef = gwOrder.id;
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: { memberId: req.auth.id, totalAmount, shippingAddress: req.body.shippingAddress, gatewayRef, items: { create: items } },
        include: { items: true },
      });
      for (const item of items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
      }
      return created;
    });

    res.status(201).json({ order, keyId: env.razorpay.keyId });
  })
);

router.get(
  "/orders/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { memberId: req.auth.id },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ orders });
  })
);

// District/state visibility into all orders ("simple order-tracking screen").
router.get(
  "/orders",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { status: req.query.status || undefined },
      include: {
        items: { include: { product: { select: { name: true } } } },
        member: { select: { fullName: true, memberNumber: true, district: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ orders });
  })
);

router.patch(
  "/orders/:id/status",
  requireAuth,
  requireRole("DISTRICT_ADMIN"),
  validate({ body: z.object({ status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]) }) }),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.update({ where: { id: req.params.id }, data: req.body });
    res.json({ order });
  })
);

module.exports = router;
