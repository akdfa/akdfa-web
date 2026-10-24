const test = require("node:test");
const assert = require("node:assert/strict");
const { call, stub, reset, called, people, stop } = require("./helpers/api");

test.afterEach(reset);
test.after(stop);

const { state, district1, unit1, unit1b, member1 } = people;
const row = (over = {}) => ({ id: "t1", fullName: "Test Person", email: "t@x.in", phone: "1", role: "MEMBER", status: "ACTIVE",
  memberNumber: "AKDFA-00007", districtId: "D1", unitId: "U1", passwordHash: "x", membershipExpiresAt: new Date(Date.now() + 90 * 864e5), ...over });

function stubWrites(current) {
  stub("member.findUnique", async ({ where }) => ({ ...current, id: where.id })); // the row has whatever id was asked for
  stub("member.update", async ({ data }) => ({ ...current, ...data }));
  stub("refreshToken.updateMany", async () => ({ count: 1 }));
  stub("$transaction", async (ops) => Promise.all(ops));
  stub("auditLog.create", async () => ({}));
  stub("notificationPreference.findMany", async () => []);
  stub("notification.createMany", async () => ({ count: 1 }));
}

test("suspend: only admins whose scope covers the member, never yourself or a peer", async () => {
  stubWrites(row());
  assert.equal((await call("POST", "/members/t1/suspend", { as: member1 })).status, 403, "plain member");
  assert.equal((await call("POST", "/members/t1/suspend", { as: unit1b })).status, 403, "other unit");
  assert.equal((await call("POST", "/members/" + unit1.id + "/suspend", { as: unit1 })).status, 400, "yourself");
  stubWrites(row({ role: "UNIT_ADMIN" }));
  assert.equal((await call("POST", "/members/t1/suspend", { as: unit1 })).status, 403, "a peer admin");
  assert.equal(called("member.update").length, 0, "nothing written by the refused calls");
});

test("suspend: sets SUSPENDED, signs the member out everywhere, and is audited with the caller's IP", async () => {
  stubWrites(row());
  const r = await call("POST", "/members/t1/suspend", { as: unit1, body: { reason: "Misconduct at event" } });
  assert.equal(r.status, 200);
  assert.equal(called("member.update")[0].args[0].data.status, "SUSPENDED");
  assert.equal(called("refreshToken.updateMany").length, 1, "refresh tokens revoked");
  const audit = called("auditLog.create")[0].args[0].data;
  assert.equal(audit.action, "MEMBER_SUSPENDED");
  assert.ok(audit.metadata.ip, "client IP recorded in the audit log");
  assert.equal(audit.metadata.reason, "Misconduct at event");
  assert.equal(r.json.member.passwordHash, undefined, "no secrets in the response");
});

test("suspend: only active or lapsed members can be suspended", async () => {
  stubWrites(row({ status: "PENDING" }));
  assert.equal((await call("POST", "/members/t1/suspend", { as: district1 })).status, 400);
  stubWrites(row({ status: "SUSPENDED" }));
  assert.equal((await call("POST", "/members/t1/suspend", { as: district1 })).status, 400);
});

test("reinstate: back to ACTIVE, or LAPSED if the year ran out while suspended", async () => {
  stubWrites(row({ status: "SUSPENDED" }));
  assert.equal((await call("POST", "/members/t1/reinstate", { as: unit1 })).status, 200);
  assert.equal(called("member.update")[0].args[0].data.status, "ACTIVE");
  reset();
  stubWrites(row({ status: "SUSPENDED", membershipExpiresAt: new Date(Date.now() - 864e5) }));
  assert.equal((await call("POST", "/members/t1/reinstate", { as: state })).status, 200);
  assert.equal(called("member.update")[0].args[0].data.status, "LAPSED");
  reset();
  stubWrites(row({ status: "ACTIVE" }));
  assert.equal((await call("POST", "/members/t1/reinstate", { as: unit1 })).status, 400, "not suspended");
  stubWrites(row({ status: "SUSPENDED", districtId: "D2", unitId: "U2" }));
  assert.equal((await call("POST", "/members/t1/reinstate", { as: district1 })).status, 403, "other district");
});

test("approve sends a welcome email without ever failing the approval", async () => {
  stub("member.findUnique", async () => row({ status: "PENDING" }));
  stub("member.update", async () => row({ status: "ACTIVE" }));
  stub("referral.updateMany", async () => ({ count: 0 }));
  stub("auditLog.create", async () => ({}));
  stub("notificationPreference.findMany", async () => []);
  stub("notification.createMany", async () => ({ count: 1 }));
  assert.equal((await call("POST", "/members/t1/approve", { as: unit1 })).status, 200);
  assert.equal(called("auditLog.create")[0].args[0].data.action, "MEMBER_APPROVED");
});

test("public: fee preview config and the membership-number lookup", async () => {
  const cfg = await call("GET", "/public/config");
  assert.equal(cfg.status, 200);
  assert.equal(typeof cfg.json.membershipFeeInr, "number");

  stub("member.findUnique", async () => row({ fullName: "Akhil Sebastian Kurian", district: { name: "Ernakulam" } }));
  const ok = await call("GET", "/public/members/lookup?number=akdfa-00007");
  assert.equal(ok.status, 200);
  assert.equal(ok.json.found, true);
  assert.equal(ok.json.valid, true);
  assert.equal(ok.json.name, "Akhil K.", "name is masked");
  assert.equal(ok.json.email, undefined, "no contact details leak");
  assert.equal(ok.json.phone, undefined);
  assert.equal(called("member.findUnique")[0].args[0].where.memberNumber, "AKDFA-00007", "number is upper-cased");

  stub("member.findUnique", async () => row({ status: "SUSPENDED", district: { name: "Ernakulam" } }));
  const s = await call("GET", "/public/members/lookup?number=AKDFA-00007");
  assert.equal(s.json.valid, false);
  assert.equal(s.json.membershipStatus, "SUSPENDED");

  stub("member.findUnique", async () => null);
  assert.equal((await call("GET", "/public/members/lookup?number=AKDFA-99999")).json.found, false);
  assert.equal((await call("GET", "/public/members/lookup?number=bad%20id!")).status, 400);
});
