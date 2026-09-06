// Server-rendered receipt / invoice pages. The browser can save these as PDF
// (Ctrl/Cmd-P → Save as PDF). Kept as plain self-contained HTML — no template
// engine, no PDF dependency.

const env = require("../config/env");

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—");

function shell(title, bodyRows, meta) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.6}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #d4af37;padding-bottom:16px;margin-bottom:24px}
  .org{font-weight:800;font-size:1.4rem;letter-spacing:.02em}
  .org small{display:block;font-weight:500;color:#666;font-size:.8rem}
  h1{font-size:1.1rem;text-transform:uppercase;letter-spacing:.12em;color:#666;margin:0 0 4px}
  .meta{color:#666;font-size:.9rem}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  td,th{text-align:left;padding:10px 8px;border-bottom:1px solid #e5e5e5}
  th{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:#888}
  .total{font-weight:800;font-size:1.1rem}
  .foot{margin-top:32px;color:#888;font-size:.82rem;border-top:1px solid #e5e5e5;padding-top:16px}
  .paid{display:inline-block;border:2px solid #2f9b61;color:#2f9b61;font-weight:800;padding:2px 10px;border-radius:6px;transform:rotate(-4deg)}
  @media print{body{margin:0}}
</style></head><body>
<div class="head">
  <div class="org">AKDFA<small>All Kerala Dhoni Fans Association · Reg 949/17</small></div>
  <div style="text-align:right"><h1>${esc(title)}</h1><div class="meta">${meta}</div></div>
</div>
${bodyRows}
<div class="foot">This is a computer-generated document. For queries contact info@akdfa.com.<br>${esc(env.publicBaseUrl)}</div>
</body></html>`;
}

function membershipReceiptHtml(fee, member) {
  const rows = `
    <p><strong>${esc(member.fullName)}</strong> · Member ${esc(member.memberNumber)}<br>
    ${esc(member.district?.name || "")} · ${esc(member.unit?.name || "")}</p>
    <table>
      <tr><th>Description</th><th style="text-align:right">Amount</th></tr>
      <tr><td>Annual membership fee — ${fee.period}</td><td style="text-align:right">${inr(fee.amount)}</td></tr>
      <tr><td class="total">Total paid</td><td class="total" style="text-align:right">${inr(fee.amount)}</td></tr>
    </table>
    <p>Payment reference: ${esc(fee.gatewayRef || "—")}<br>
    Membership valid until: ${day(member.membershipExpiresAt)}</p>
    <p><span class="paid">PAID</span></p>`;
  return shell("Payment Receipt", rows, `Receipt · ${day(fee.paidAt)}`);
}

function orderReceiptHtml(order, member) {
  const items = order.items
    .map(
      (i) =>
        `<tr><td>${esc(i.product?.name || "Item")}${i.size ? " (" + esc(i.size) + ")" : ""} × ${i.quantity}</td><td style="text-align:right">${inr(
          Number(i.unitPrice) * i.quantity
        )}</td></tr>`
    )
    .join("");
  const rows = `
    <p><strong>${esc(member.fullName)}</strong> · Member ${esc(member.memberNumber)}</p>
    <table>
      <tr><th>Item</th><th style="text-align:right">Amount</th></tr>
      ${items}
      <tr><td class="total">Total</td><td class="total" style="text-align:right">${inr(order.totalAmount)}</td></tr>
    </table>
    <p>Order: ${esc(order.id)}<br>Status: ${esc(order.status)}<br>Ship to: ${esc(order.shippingAddress || "—")}</p>`;
  return shell("Order Receipt", rows, `Order · ${day(order.createdAt)}`);
}

function sponsorInvoiceHtml(payment, sponsor) {
  const rows = `
    <p><strong>Billed to:</strong><br>${esc(sponsor.name)}<br>${esc(sponsor.contactName || "")}<br>${esc(sponsor.contactEmail || "")}</p>
    <table>
      <tr><th>Description</th><th style="text-align:right">Amount</th></tr>
      <tr><td>Sponsorship contribution to AKDFA${payment.note ? " — " + esc(payment.note) : ""}</td><td style="text-align:right">${inr(payment.amount)}</td></tr>
      <tr><td class="total">Total due</td><td class="total" style="text-align:right">${inr(payment.amount)}</td></tr>
    </table>
    <p>Invoice no: <strong>${esc(payment.invoiceNumber || "—")}</strong><br>
    Payment reference: ${esc(payment.gatewayRef || "—")}<br>
    ${payment.status === "SUCCESS" ? '<span class="paid">PAID</span> ' + day(payment.paidAt) : "Status: " + esc(payment.status)}</p>`;
  return shell("Tax Invoice", rows, `Invoice · ${day(payment.createdAt)}`);
}

// AKDFA/INV/<year>/<seq zero-padded>
function invoiceNumber(seq) {
  return `AKDFA/INV/${new Date().getFullYear()}/${String(seq).padStart(4, "0")}`;
}

module.exports = { membershipReceiptHtml, orderReceiptHtml, sponsorInvoiceHtml, invoiceNumber };
