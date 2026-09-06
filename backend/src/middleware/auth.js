const ApiError = require("../utils/ApiError");
const { verifyAccessToken } = require("../utils/jwt");
const asyncHandler = require("../utils/asyncHandler");

// Attaches req.auth = { id, role, districtId, unitId } from a valid Bearer token.
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw ApiError.unauthorized("Missing bearer token");
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      id: payload.sub,
      role: payload.role,
      districtId: payload.districtId,
      unitId: payload.unitId,
    };
    next();
  } catch (err) {
    throw ApiError.unauthorized("Invalid or expired token");
  }
});

// Optional auth: attaches req.auth if a valid token is present, otherwise continues anonymously.
// Used by public-read endpoints (news, events) that still want to know "is this a member?".
const attachAuthIfPresent = (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token) {
    try {
      const payload = verifyAccessToken(token);
      req.auth = {
        id: payload.sub,
        role: payload.role,
        districtId: payload.districtId,
        unitId: payload.unitId,
      };
    } catch {
      // ignore invalid token on optional-auth routes
    }
  }
  next();
};

module.exports = { requireAuth, attachAuthIfPresent };
