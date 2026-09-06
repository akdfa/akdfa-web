// Outbound email.
//   MAIL_DRIVER=log   → prints the message (default; dev)
//   MAIL_DRIVER=smtp  → sends via nodemailer using SMTP_* env vars
const env = require("../config/env");

let _transport;
function transport() {
  if (!_transport) {
    const nodemailer = require("nodemailer");
    _transport = nodemailer.createTransport({
      host: env.mail.smtp.host,
      port: env.mail.smtp.port,
      secure: env.mail.smtp.secure,
      auth: env.mail.smtp.user ? { user: env.mail.smtp.user, pass: env.mail.smtp.pass } : undefined,
    });
  }
  return _transport;
}

async function sendMail({ to, subject, text, html }) {
  if (env.mail.driver === "smtp") {
    const info = await transport().sendMail({ from: env.mail.from, to, subject, text, html });
    return { delivered: true, id: info.messageId };
  }
  if (env.mail.driver === "log") {
    // eslint-disable-next-line no-console
    console.log(
      `\n──────── EMAIL (MAIL_DRIVER=log — not actually sent) ────────\n` +
        `From:    ${env.mail.from}\nTo:      ${to}\nSubject: ${subject}\n\n${text}\n` +
        `────────────────────────────────────────────────────────────\n`
    );
    return { delivered: false, logged: true };
  }
  throw new Error(`MAIL_DRIVER="${env.mail.driver}" is not supported (use "log" or "smtp")`);
}

module.exports = { sendMail };
