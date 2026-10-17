const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

const MESSAGES = {
  PENDING: "Your membership is waiting for approval from your unit. You'll be able to do this once you're approved.",
  LAPSED: "Your membership has lapsed. Renew it under Membership Fee to continue.",
  SUSPENDED: "This account has been suspended.",
  REJECTED: "This membership application was not approved.",
};

// Gate for member-only actions (RSVP, vote, order, apply, feedback…). A freshly
// registered person can sign in, see public content and pay their fee, but can't
// take part until a unit admin approves them. Status is read fresh from the DB
// (the JWT is up to 15 minutes old, so it can't be trusted for this).
async function requireActive(req, res, next) {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const m = await prisma.member.findUnique({ where: { id: req.auth.id }, select: { status: true } });
    if (!m) throw ApiError.unauthorized("Member no longer exists");
    if (m.status !== "ACTIVE") throw ApiError.forbidden(MESSAGES[m.status] || "Your membership isn't active.");
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireActive };
