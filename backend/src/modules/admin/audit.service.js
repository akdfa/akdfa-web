const prisma = require("../../config/prisma");

// Phase 4 — "keep a record of who changed what and when." Called by any module
// performing a state/district/unit-level admin action worth auditing.
async function logAudit(actorId, action, entityType, entityId, metadata) {
  return prisma.auditLog.create({
    data: { actorId, action, entityType, entityId, metadata },
  });
}

module.exports = { logAudit };
