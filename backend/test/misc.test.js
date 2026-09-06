process.env.ENCRYPTION_KEY = "0".repeat(64);
const test = require("node:test");
const assert = require("node:assert/strict");

const { RANK, requireRole } = require("../src/middleware/requireRole");
const { membershipReceiptHtml, sponsorInvoiceHtml, invoiceNumber } = require("../src/utils/receipts");

test("role hierarchy ranks ascending", () => {
  assert.ok(RANK.MEMBER < RANK.UNIT_ADMIN);
  assert.ok(RANK.UNIT_ADMIN < RANK.DISTRICT_ADMIN);
  assert.ok(RANK.DISTRICT_ADMIN < RANK.STATE_ADMIN);
});

test("requireRole passes for equal/higher, blocks lower", () => {
  const run = (role, min) => {
    let err = "unset";
    requireRole(min)({ auth: { role } }, {}, (e) => (err = e));
    return err;
  };
  assert.ok(!run("STATE_ADMIN", "DISTRICT_ADMIN")); // next() with no error
  assert.ok(!run("DISTRICT_ADMIN", "DISTRICT_ADMIN"));
  assert.equal(run("UNIT_ADMIN", "DISTRICT_ADMIN")?.statusCode, 403);
  assert.equal(run("MEMBER", "UNIT_ADMIN")?.statusCode, 403);
});

test("requireRole 401s without auth", () => {
  let err = null;
  requireRole("MEMBER")({}, {}, (e) => (err = e));
  assert.equal(err.statusCode, 401);
});

test("invoiceNumber format", () => {
  assert.match(invoiceNumber(7), /^AKDFA\/INV\/\d{4}\/0007$/);
});

test("membership receipt renders member + amount, marked PAID", () => {
  const html = membershipReceiptHtml(
    { period: 2026, amount: 500, gatewayRef: "order_x", paidAt: new Date() },
    { fullName: "Test Member", memberNumber: "AKDFA-00009", district: { name: "Ernakulam" }, unit: { name: "Kochi Unit" } }
  );
  assert.match(html, /Test Member/);
  assert.match(html, /AKDFA-00009/);
  assert.match(html, /500\.00/);
  assert.match(html, /PAID/);
  assert.doesNotMatch(html, /<script/i);
});

test("sponsor invoice escapes HTML in the sponsor name", () => {
  const html = sponsorInvoiceHtml(
    { amount: 1000, invoiceNumber: "AKDFA/INV/2026/0001", status: "SUCCESS", createdAt: new Date(), paidAt: new Date() },
    { name: "<img src=x onerror=alert(1)>", contactName: "A", contactEmail: "a@b.com" }
  );
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
});
