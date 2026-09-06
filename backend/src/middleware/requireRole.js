const ApiError = require("../utils/ApiError");

// Role hierarchy — a STATE_ADMIN can do anything a DISTRICT_ADMIN can, etc.
const RANK = { MEMBER: 0, UNIT_ADMIN: 1, DISTRICT_ADMIN: 2, STATE_ADMIN: 3 };

// requireRole("DISTRICT_ADMIN") passes for DISTRICT_ADMIN and STATE_ADMIN.
function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.auth) {
      return next(ApiError.unauthorized());
    }
    if (RANK[req.auth.role] < RANK[minRole]) {
      return next(ApiError.forbidden(`Requires role ${minRole} or higher`));
    }
    next();
  };
}

module.exports = { requireRole, RANK };
