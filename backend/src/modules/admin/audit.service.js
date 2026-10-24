const prisma = require("../../config/prisma");
const { current } = require("../../utils/requestContext");

// Phase 4 — "keep a record of who changed what and when." Called by any module
// performing a state/district/unit-level admin action worth auditing.
// The caller's IP address is added to the metadata automatically.
async function logAudit(actorId, action, entityType, entityId, metadata) {
  const { ip } = current();
  return prisma.auditLog.create({
    data: { actorId, action, entityType, entityId, metadata: { ...(metadata || {}), ...(ip ? { ip } : {}) } },
  });
}

module.exports = { logAudit };
