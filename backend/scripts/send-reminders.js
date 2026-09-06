/* eslint-disable no-console */
// Phase 5 — "a reminder before their membership lapses".
//
// Creates an in-app notification for every ACTIVE member whose membership
// expires within the next 30 days and who hasn't been reminded in the last
// 21 days. Idempotent — safe to run daily.
//
// Wire it to a scheduler:
//   Linux/macOS cron:   0 9 * * *  cd /path/to/backend && node scripts/send-reminders.js
//   Windows Task Scheduler: daily action → node C:\...\backend\scripts\send-reminders.js
//
// When an email/SMS provider is added, send through it here too.
const prisma = require("../src/config/prisma");
const { notify } = require("../src/modules/notifications/notify.service");
const { sendMail } = require("../src/utils/mail");

const WINDOW_DAYS = 30;
const COOLDOWN_DAYS = 21;

(async () => {
  const now = new Date();
  const cutoff = new Date(now.getTime() + WINDOW_DAYS * 86400000);
  const cooldown = new Date(now.getTime() - COOLDOWN_DAYS * 86400000);

  const due = await prisma.member.findMany({
    where: {
      status: "ACTIVE",
      membershipExpiresAt: { not: null, lte: cutoff, gte: now },
      OR: [{ renewalReminderAt: null }, { renewalReminderAt: { lt: cooldown } }],
    },
    select: { id: true, membershipExpiresAt: true, fullName: true, email: true },
  });

  // Also flag members who have already lapsed but are still marked ACTIVE.
  const lapsed = await prisma.member.findMany({
    where: { status: "ACTIVE", membershipExpiresAt: { lt: now } },
    select: { id: true },
  });

  let sent = 0;
  for (const m of due) {
    const days = Math.ceil((m.membershipExpiresAt - now) / 86400000);
    const body = `Your AKDFA membership expires in ${days} day${days === 1 ? "" : "s"}. Renew from Membership Fee to keep your digital card active.`;
    await notify(m.id, { title: "Membership renewal due soon", body, category: "PAYMENT" });
    try {
      await sendMail({ to: m.email, subject: "AKDFA membership renewal due soon", text: `Hi ${m.fullName},\n\n${body}` });
    } catch (_) {
      /* mail provider not configured — the in-app notification still went out */
    }
    await prisma.member.update({ where: { id: m.id }, data: { renewalReminderAt: now } });
    sent++;
  }

  if (lapsed.length) {
    await prisma.member.updateMany({
      where: { id: { in: lapsed.map((m) => m.id) } },
      data: { status: "LAPSED" },
    });
  }

  console.log(`Reminders sent: ${sent}. Members moved to LAPSED: ${lapsed.length}.`);
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
