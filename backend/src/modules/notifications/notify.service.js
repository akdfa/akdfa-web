const prisma = require("../../config/prisma");

// Create notification rows, honouring each member's NotificationPreference.
//
// Rule: a member is opted OUT of a category only if they have preference rows
// for it AND every one is disabled. No rows for the category → they get it
// (sensible default). Categories with no UI toggle (e.g. PAYMENT for a receipt,
// FEEDBACK replies) can pass `force: true` to always deliver.
async function notify(memberIdOrIds, { title, body, category, channel = "PUSH", force = false, broadcastDistrictId }) {
  const ids = [...new Set((Array.isArray(memberIdOrIds) ? memberIdOrIds : [memberIdOrIds]).filter(Boolean))];
  if (!ids.length) return 0;

  let allowed = ids;
  if (!force) {
    const prefs = await prisma.notificationPreference.findMany({
      where: { memberId: { in: ids }, category },
      select: { memberId: true, enabled: true },
    });
    const byMember = new Map();
    for (const p of prefs) {
      const arr = byMember.get(p.memberId) || [];
      arr.push(p.enabled);
      byMember.set(p.memberId, arr);
    }
    allowed = ids.filter((id) => {
      const flags = byMember.get(id);
      return !flags || flags.length === 0 || flags.some(Boolean);
    });
  }
  if (!allowed.length) return 0;

  await prisma.notification.createMany({
    data: allowed.map((memberId) => ({ memberId, title, body, category, channel, broadcastDistrictId })),
  });
  return allowed.length;
}

module.exports = { notify };
