const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");

const router = Router();

// Phase 2 — "Vote in polls, guess match results."
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const polls = await prisma.poll.findMany({
      orderBy: { createdAt: "desc" },
      include: { options: { include: { _count: { select: { votes: true } } } } },
    });
    const myVotes = await prisma.pollVote.findMany({
      where: { memberId: req.auth.id, option: { pollId: { in: polls.map((p) => p.id) } } },
      select: { optionId: true },
    });
    const votedOptionIds = new Set(myVotes.map((v) => v.optionId));
    res.json({
      polls: polls.map((p) => ({
        ...p,
        myOptionId: p.options.find((o) => votedOptionIds.has(o.id))?.id || null,
        totalVotes: p.options.reduce((sum, o) => sum + o._count.votes, 0),
      })),
    });
  })
);

router.post(
  "/",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({
    body: z.object({
      question: z.string().min(2),
      scope: z.enum(["STATE", "DISTRICT", "UNIT"]).default("STATE"),
      closesAt: z.coerce.date().optional(),
      options: z.array(z.string().min(1)).min(2),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { options, ...pollData } = req.body;
    const poll = await prisma.poll.create({
      data: {
        ...pollData,
        createdById: req.auth.id,
        options: { create: options.map((label) => ({ label })) },
      },
      include: { options: true },
    });
    res.status(201).json({ poll });
  })
);

router.post(
  "/options/:optionId/vote",
  requireAuth,
  asyncHandler(async (req, res) => {
    const option = await prisma.pollOption.findUnique({ where: { id: req.params.optionId } });
    if (!option) throw ApiError.notFound("Poll option not found");

    const vote = await prisma.$transaction(async (tx) => {
      // One vote per poll — clear any prior vote on a sibling option first.
      await tx.pollVote.deleteMany({
        where: { memberId: req.auth.id, option: { pollId: option.pollId }, optionId: { not: option.id } },
      });
      return tx.pollVote.upsert({
        where: { optionId_memberId: { optionId: option.id, memberId: req.auth.id } },
        update: {},
        create: { optionId: option.id, memberId: req.auth.id },
      });
    });
    res.status(201).json({ vote });
  })
);

module.exports = router;
