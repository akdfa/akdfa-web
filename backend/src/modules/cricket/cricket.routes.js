const { Router } = require("express");
const { z } = require("zod");
const prisma = require("../../config/prisma");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/requireRole");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");

const { requireActive } = require("../../middleware/requireActive");

const router = Router();

// ---- Teams --------------------------------------------------------------
// Phase 3 — "Manage cricket teams: register teams, build rosters, name captains."

router.get(
  "/teams",
  asyncHandler(async (req, res) => {
    const { unitId } = req.query;
    const teams = await prisma.team.findMany({
      where: { unitId: unitId || undefined },
      include: { captain: { select: { fullName: true } }, _count: { select: { players: true } } },
    });
    res.json({ teams });
  })
);

router.get(
  "/teams/:id",
  asyncHandler(async (req, res) => {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: { players: { include: { member: { select: { fullName: true } } } } },
    });
    if (!team) throw ApiError.notFound("Team not found");
    res.json({ team });
  })
);

router.post(
  "/teams",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({ body: z.object({ unitId: z.string(), name: z.string().min(2), season: z.string(), captainId: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const team = await prisma.team.create({ data: req.body });
    res.status(201).json({ team });
  })
);

router.patch(
  "/teams/:id",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({ body: z.object({ name: z.string().min(2).optional(), captainId: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const team = await prisma.team.update({ where: { id: req.params.id }, data: req.body });
    res.json({ team });
  })
);

// ---- Players --------------------------------------------------------------
// Phase 2 — "See your local team's roster."

router.post(
  "/teams/:teamId/players",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({
    body: z.object({
      memberId: z.string(),
      jerseyNumber: z.number().int().optional(),
      position: z.string().optional(),
      battingStyle: z.string().optional(),
      bowlingStyle: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const player = await prisma.player.create({ data: { ...req.body, teamId: req.params.teamId } });
    res.status(201).json({ player });
  })
);

router.delete(
  "/players/:id",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  asyncHandler(async (req, res) => {
    await prisma.player.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

// ---- Matches --------------------------------------------------------------
// Phase 2 — "upcoming matches" / Phase 3 — "schedule practice matches" / submit scorecards.

router.get(
  "/matches",
  asyncHandler(async (req, res) => {
    const { teamId, status } = req.query;
    const matches = await prisma.match.findMany({
      where: {
        status: status || undefined,
        OR: teamId ? [{ homeTeamId: teamId }, { awayTeamId: teamId }] : undefined,
      },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { scheduledAt: "desc" },
    });
    res.json({ matches });
  })
);

router.get(
  "/matches/:id",
  asyncHandler(async (req, res) => {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        homeTeam: true,
        awayTeam: true,
        playerStats: { include: { player: { include: { member: { select: { fullName: true } } } } } },
        _count: { select: { predictions: true } },
      },
    });
    if (!match) throw ApiError.notFound("Match not found");
    res.json({ match });
  })
);

router.post(
  "/matches",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({
    body: z.object({
      eventId: z.string().optional(),
      homeTeamId: z.string(),
      awayTeamId: z.string(),
      venue: z.string().optional(),
      scheduledAt: z.coerce.date(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const match = await prisma.match.create({ data: req.body });
    res.status(201).json({ match });
  })
);

// Phase 3 — "Log events and matches: submit scores, brackets ... up to the state."
router.patch(
  "/matches/:id/result",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({
    body: z.object({
      status: z.enum(["LIVE", "COMPLETED", "CANCELLED"]),
      resultSummary: z.string().optional(),
      homeScore: z.string().optional(),
      awayScore: z.string().optional(),
      photos: z.array(z.string().url()).optional(),
      stats: z
        .array(z.object({ playerId: z.string(), runs: z.number().int().optional(), wickets: z.number().int().optional(), catches: z.number().int().optional() }))
        .optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { stats, ...matchData } = req.body;
    const match = await prisma.match.update({ where: { id: req.params.id }, data: matchData });

    if (stats?.length) {
      await prisma.$transaction(
        stats.map((s) =>
          prisma.playerMatchStat.upsert({
            where: { matchId_playerId: { matchId: match.id, playerId: s.playerId } },
            update: s,
            create: { ...s, matchId: match.id, playerId: s.playerId },
          })
        )
      );
    }

    res.json({ match });
  })
);

// Phase 2 — "guess match results."
router.post(
  "/matches/:id/predict",
  requireAuth,
  requireActive,
  validate({ body: z.object({ predictedWinnerTeamId: z.string() }) }),
  asyncHandler(async (req, res) => {
    const prediction = await prisma.matchPrediction.upsert({
      where: { matchId_memberId: { matchId: req.params.id, memberId: req.auth.id } },
      update: req.body,
      create: { ...req.body, matchId: req.params.id, memberId: req.auth.id },
    });
    res.status(201).json({ prediction });
  })
);

// ---- Trials --------------------------------------------------------------
// Phase 2 — "trial dates ... and put your name forward."

router.get(
  "/trials",
  asyncHandler(async (req, res) => {
    const { teamId } = req.query;
    const trials = await prisma.trial.findMany({ where: { teamId: teamId || undefined }, orderBy: { scheduledAt: "asc" } });
    res.json({ trials });
  })
);

router.post(
  "/trials",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({ body: z.object({ teamId: z.string(), eventId: z.string().optional(), scheduledAt: z.coerce.date(), location: z.string().optional(), description: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const trial = await prisma.trial.create({ data: req.body });
    res.status(201).json({ trial });
  })
);

router.get(
  "/trials/:id/applications",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  asyncHandler(async (req, res) => {
    const applications = await prisma.trialApplication.findMany({
      where: { trialId: req.params.id },
      include: { member: { select: { fullName: true, memberNumber: true, phone: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json({ applications });
  })
);

router.post(
  "/trials/:id/apply",
  requireAuth,
  requireActive,
  asyncHandler(async (req, res) => {
    const application = await prisma.trialApplication.upsert({
      where: { trialId_memberId: { trialId: req.params.id, memberId: req.auth.id } },
      update: {},
      create: { trialId: req.params.id, memberId: req.auth.id },
    });
    res.status(201).json({ application });
  })
);

router.patch(
  "/trials/applications/:id",
  requireAuth,
  requireRole("UNIT_ADMIN"),
  validate({ body: z.object({ status: z.enum(["SHORTLISTED", "SELECTED", "REJECTED"]), notes: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const application = await prisma.trialApplication.update({ where: { id: req.params.id }, data: req.body });
    res.json({ application });
  })
);

module.exports = router;
