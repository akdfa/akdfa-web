const test = require("node:test");
const assert = require("node:assert/strict");
const { call, stub, reset, called, people, stop } = require("./helpers/api");

test.afterEach(reset);
test.after(stop);

const { state, district1, unit1, unit1b, member1 } = people;
const otherDistrictEvent = { id: "e2", title: "Away cup", districtId: "D2", unitId: "U2", createdById: "someone" };
const homeEvent = { id: "e1", title: "Home cup", districtId: "D1", unitId: "U1", createdById: "someone" };

/* ---------------- events ---------------- */
test("events: a district admin cannot edit or delete another district's event", async () => {
  stub("event.findUnique", async () => otherDistrictEvent);
  stub("event.update", async () => otherDistrictEvent);
  stub("event.delete", async () => ({ ...otherDistrictEvent, photos: [] }));
  assert.equal((await call("PATCH", "/events/e2", { as: district1, body: { title: "hacked" } })).status, 403);
  assert.equal((await call("DELETE", "/events/e2", { as: district1 })).status, 403);
  assert.equal((await call("PATCH", "/events/e2/photos", { as: district1, body: { photos: [] } })).status, 403);
  assert.equal(called("event.update").length + called("event.delete").length, 0, "nothing may be written");
});

test("events: own district / own unit / creator / state are allowed", async () => {
  stub("event.findUnique", async () => homeEvent);
  stub("event.update", async () => homeEvent);
  assert.equal((await call("PATCH", "/events/e1", { as: district1, body: { title: "ok" } })).status, 200);
  assert.equal((await call("PATCH", "/events/e1", { as: unit1, body: { title: "ok" } })).status, 200);
  assert.equal((await call("PATCH", "/events/e1", { as: state, body: { title: "ok" } })).status, 200);
  // a unit admin of a *different* unit in the same district is refused
  assert.equal((await call("PATCH", "/events/e1", { as: unit1b, body: { title: "no" } })).status, 403);
  // ...unless they created it
  stub("event.findUnique", async () => ({ ...homeEvent, createdById: unit1b.id }));
  assert.equal((await call("PATCH", "/events/e1", { as: unit1b, body: { title: "mine" } })).status, 200);
});

test("events: cannot create outside your scope or a state-wide event", async () => {
  stub("unit.findUnique", async ({ where }) => ({ id: where.id, districtId: where.id === "U2" ? "D2" : "D1" }));
  stub("event.create", async ({ data }) => ({ id: "new", ...data }));
  const base = { title: "Cup", type: "TOURNAMENT", startsAt: "2026-12-01T10:00:00Z" };
  assert.equal((await call("POST", "/events", { as: district1, body: { ...base, scope: "DISTRICT", districtId: "D2" } })).status, 403);
  assert.equal((await call("POST", "/events", { as: unit1, body: { ...base, scope: "UNIT", unitId: "U2" } })).status, 403);
  assert.equal((await call("POST", "/events", { as: district1, body: { ...base, scope: "STATE" } })).status, 403);
  assert.equal(called("event.create").length, 0);
  const ok = await call("POST", "/events", { as: district1, body: { ...base, scope: "DISTRICT" } });
  assert.equal(ok.status, 201);
  assert.equal(called("event.create")[0].args[0].data.districtId, "D1", "defaults to the caller's own district");
});

test("events: moving an event into another district is refused", async () => {
  stub("event.findUnique", async () => homeEvent);
  stub("event.update", async () => homeEvent);
  const r = await call("PATCH", "/events/e1", { as: district1, body: { districtId: "D2", scope: "DISTRICT" } });
  assert.equal(r.status, 403);
  assert.equal(called("event.update").length, 0);
});

/* ---------------- members ---------------- */
const memberRow = (over = {}) => ({ id: "t1", fullName: "T", email: "t@x.in", phone: "1", role: "MEMBER", status: "ACTIVE", memberNumber: "AKDFA-1",
  districtId: "D1", unitId: "U1", passwordHash: "x", unit: { name: "u" }, district: { name: "d" }, badges: [], membershipExpiresAt: null, ...over });

test("members: GET /:id is limited to yourself and admins whose scope covers the member", async () => {
  stub("member.findUnique", async ({ where }) => memberRow({ id: where.id }));
  assert.equal((await call("GET", "/members/t1", { as: district1 })).status, 200);
  assert.equal((await call("GET", "/members/t1", { as: unit1 })).status, 200);
  assert.equal((await call("GET", "/members/t1", { as: state })).status, 200);
  assert.equal((await call("GET", "/members/" + member1.id, { as: member1 })).status, 200, "self");
  assert.equal((await call("GET", "/members/t1", { as: member1 })).status, 403, "a peer member");
  assert.equal((await call("GET", "/members/t1", { as: unit1b })).status, 403, "other unit, same district");
  stub("member.findUnique", async ({ where }) => memberRow({ id: where.id, districtId: "D2", unitId: "U2" }));
  assert.equal((await call("GET", "/members/t1", { as: district1 })).status, 403, "other district");
  assert.equal((await call("GET", "/members/t1/card", { as: district1 })).status, 403, "card/verification link too");
});

test("members: PATCH /:id and role changes respect scope and rank", async () => {
  stub("member.findUnique", async ({ where }) => memberRow({ id: where.id, districtId: "D2", unitId: "U2" }));
  stub("member.update", async () => memberRow());
  assert.equal((await call("PATCH", "/members/t1", { as: district1, body: { fullName: "Hacked Name" } })).status, 403);
  assert.equal((await call("PATCH", "/members/t1/role", { as: district1, body: { role: "UNIT_ADMIN" } })).status, 403, "other district");
  stub("member.findUnique", async ({ where }) => memberRow({ id: where.id, role: "DISTRICT_ADMIN" }));
  assert.equal((await call("PATCH", "/members/t1/role", { as: district1, body: { role: "MEMBER" } })).status, 403, "peer admin");
  assert.equal(called("member.update").length, 0);
  stub("member.findUnique", async ({ where }) => memberRow({ id: where.id }));
  stub("auditLog.create", async () => ({}));
  assert.equal((await call("PATCH", "/members/t1/role", { as: district1, body: { role: "UNIT_ADMIN" } })).status, 200, "own district, lower rank");
});

/* ---------------- units ---------------- */
test("units: approve/reject only inside your own district", async () => {
  stub("unit.findUnique", async () => ({ id: "UX", districtId: "D2" }));
  stub("unit.update", async () => ({ id: "UX" }));
  assert.equal((await call("POST", "/units/UX/approve", { as: district1 })).status, 403);
  assert.equal((await call("POST", "/units/UX/reject", { as: district1 })).status, 403);
  assert.equal(called("unit.update").length, 0);
  stub("unit.findUnique", async () => ({ id: "UY", districtId: "D1" }));
  stub("auditLog.create", async () => ({}));
  assert.equal((await call("POST", "/units/UY/approve", { as: district1 })).status, 200);
});

/* ---------------- polls, news, sponsors ---------------- */
test("polls: state-wide polls are State-only; other districts' polls are untouchable", async () => {
  stub("poll.create", async () => ({ id: "p" }));
  const body = { question: "Best player?", scope: "STATE", options: ["A", "B"] };
  assert.equal((await call("POST", "/polls", { as: district1, body })).status, 403);
  stub("poll.findUnique", async () => ({ id: "p2", createdById: "other", createdBy: { districtId: "D2", unitId: "U2" } }));
  stub("poll.update", async () => ({})); stub("poll.delete", async () => ({}));
  assert.equal((await call("DELETE", "/polls/p2", { as: district1 })).status, 403);
  assert.equal((await call("POST", "/polls/p2/close", { as: district1 })).status, 403);
  assert.equal(called("poll.delete").length + called("poll.update").length, 0);
});

test("news: cannot post into or delete from another district", async () => {
  stub("newsPost.create", async () => ({ id: "n" }));
  const post = { title: "Hello", body: "World", scope: "DISTRICT", districtId: "D2" };
  assert.equal((await call("POST", "/news", { as: district1, body: post })).status, 403);
  stub("newsPost.findUnique", async () => ({ id: "n2", districtId: "D2", authorId: "other", coverImageUrl: null }));
  stub("newsPost.delete", async () => ({ coverImageUrl: null }));
  assert.equal((await call("DELETE", "/news/n2", { as: district1 })).status, 403);
  assert.equal(called("newsPost.delete").length, 0);
});

test("sponsors: district admins manage only their own district's sponsors; state-level ones are State-only", async () => {
  stub("sponsor.update", async () => ({})); stub("sponsor.delete", async () => ({}));
  stub("sponsor.findUnique", async () => ({ id: "s", districtId: "D2" }));
  assert.equal((await call("PATCH", "/sponsors/s", { as: district1, body: { name: "New name" } })).status, 403);
  stub("sponsor.findUnique", async () => ({ id: "s", districtId: null }));
  assert.equal((await call("DELETE", "/sponsors/s", { as: district1 })).status, 403, "state-level sponsor");
  assert.equal((await call("GET", "/sponsors/districts/D2/logs", { as: district1 })).status, 403);
  assert.equal(called("sponsor.update").length + called("sponsor.delete").length, 0);
});

/* ---------------- cricket, store, growth ---------------- */
test("cricket: trial applicants' contact details stay inside the team's scope", async () => {
  stub("trial.findUnique", async () => ({ id: "t", teamId: "tm" }));
  stub("team.findUnique", async () => ({ id: "tm", unitId: "U2", unit: { districtId: "D2" } }));
  stub("trialApplication.findMany", async () => [{ member: { phone: "9" } }]);
  const r = await call("GET", "/cricket/trials/t/applications", { as: unit1 });
  assert.equal(r.status, 403);
  assert.equal(called("trialApplication.findMany").length, 0);
});

test("cricket: cannot edit another unit's team or roster", async () => {
  stub("team.findUnique", async () => ({ id: "tm", unitId: "U2", unit: { districtId: "D2" } }));
  stub("team.update", async () => ({})); stub("player.create", async () => ({}));
  assert.equal((await call("PATCH", "/cricket/teams/tm", { as: district1, body: { name: "Renamed" } })).status, 403);
  assert.equal((await call("POST", "/cricket/teams/tm/players", { as: district1, body: { memberId: "m" } })).status, 403);
  assert.equal(called("team.update").length + called("player.create").length, 0);
});

test("store: order list is limited to your district; status changes outside it are refused", async () => {
  stub("order.findMany", async () => []);
  await call("GET", "/store/orders", { as: district1 });
  assert.deepEqual(called("order.findMany")[0].args[0].where.member, { districtId: "D1" });
  reset();
  stub("order.findMany", async () => []);
  await call("GET", "/store/orders", { as: state });
  assert.equal(called("order.findMany")[0].args[0].where.member, undefined, "state sees all");
  reset();
  stub("order.findUnique", async () => ({ id: "o", member: { districtId: "D2" } }));
  stub("order.update", async () => ({}));
  assert.equal((await call("PATCH", "/store/orders/o/status", { as: district1, body: { status: "SHIPPED" } })).status, 403);
  assert.equal(called("order.update").length, 0);
});

test("growth: badges and referral rewards only for members in your scope", async () => {
  stub("member.findUnique", async () => ({ id: "t", districtId: "D2", unitId: "U2" }));
  stub("memberBadge.upsert", async () => ({}));
  assert.equal((await call("POST", "/growth/badges/b1/award/t", { as: unit1 })).status, 403);
  stub("referral.findUnique", async () => ({ id: "r", referrer: { districtId: "D2", unitId: "U2" } }));
  stub("referral.update", async () => ({}));
  assert.equal((await call("POST", "/growth/referrals/r/reward", { as: unit1 })).status, 403);
  assert.equal(called("memberBadge.upsert").length + called("referral.update").length, 0);
});

test("unauthenticated and plain-member callers are refused before any scope logic", async () => {
  assert.equal((await call("PATCH", "/events/e1", { body: { title: "x" } })).status, 401);
  assert.equal((await call("PATCH", "/events/e1", { as: member1, body: { title: "x" } })).status, 403);
});
