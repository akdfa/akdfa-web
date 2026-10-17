// Who may manage what. `requireRole` only checks the *level* of the caller; this checks *where* they
// may act. Every write that targets an existing record (or names a district/unit in its body) must pass
// through assertCanManage so a district admin cannot touch another district's data.
//
//   STATE_ADMIN     → anywhere
//   DISTRICT_ADMIN  → records in their own district
//   UNIT_ADMIN      → records in their own unit
//   anyone          → records they created themselves (target.ownerId)
const ApiError = require("../utils/ApiError");

// target: { districtId?, unitId?, ownerId? }  (a unit-level record should carry both ids)
function canManage(auth, target = {}) {
  if (!auth) return false;
  if (auth.role === "STATE_ADMIN") return true;
  if (target.ownerId && target.ownerId === auth.id) return true;
  if (auth.role === "DISTRICT_ADMIN") return Boolean(target.districtId) && target.districtId === auth.districtId;
  if (auth.role === "UNIT_ADMIN") return Boolean(target.unitId) && target.unitId === auth.unitId;
  return false;
}

function assertCanManage(auth, target, message = "You can only manage records in your own district or unit") {
  if (!canManage(auth, target)) throw ApiError.forbidden(message);
}

// Reading a member's private details: themselves, or an admin whose scope covers them.
function canViewMember(auth, member) {
  if (!auth || !member) return false;
  if (auth.id === member.id) return true;
  return canManage(auth, { districtId: member.districtId, unitId: member.unitId });
}

// Helpers that turn a loaded record into a scope target.
const scopeOfUnit = (unit) => ({ districtId: unit.districtId, unitId: unit.id });
const scopeOfMember = (m) => ({ districtId: m.districtId, unitId: m.unitId });

module.exports = { canManage, assertCanManage, canViewMember, scopeOfUnit, scopeOfMember };
