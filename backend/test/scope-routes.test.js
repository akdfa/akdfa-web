const test = require("node:test");
const assert = require("node:assert/strict");
const { call, stub, reset, called, people, stop } = require("./helpers/api");

test.afterEach(reset);
test.after(stop);

const { state, district1, unit1, unit1b, member1 } = people;
const homeEvent = { id: "e1", title: "Home cup", districtId: "D1", unitId: "U1", createdById: "someone" };

/* ---------------- events (State Committee only) ---------------- */
test("events: only the State Committee adds, edits or deletes events", async () => {
  stub("event.findUnique", async () => homeEvent);
  stub("event.create", async ({ data }) => ({ id: "new", ...data }));
  stub("event.update", async () => homeEvent);
  stub("event.delete", async () => ({ ...homeEvent, photos: [] }));
  const body = { title: "Cup", type: "TOURNAMENT", scope: "DISTRICT", startsAt: "2026-12-01T10:00:00Z" };
  for (const who of [district1, unit1, member1]) {
    assert.equal((await call("POST", "/events", { as: who, body })).status, 403, who.role + " cannot add");
    assert.equal((await call("PATCH", "/events/e1", { as: who, body: { title: "x" } })).status, 403, who.role + " cannot edit");
    assert.equal((await call("PATCH", "/events/e1/photos", { as: who, body: { photos: [] } })).status, 403);
    assert.equal((await call("DELETE", "/events/e1", { as: who })).status, 403, who.role + " cannot delete");
    assert.equal((await call("PUT", "/events/e1/charity-report", { as: who, body: { peopleHelped: 5 } })).status, 403);
  }
  assert.equal(called("event.create").length + called("event.update").length + called("event.delete").length, 0, "nothing written");
  assert.equal((await call("POST", "/events", { as: state, body })).status, 201);
  assert.equal((await call("PATCH", "/events/e1", { as: state, body: { title: "ok" } })).status, 200);
  assert.equal((await call("DELETE", "/events/e1", { as: state })).status, 204);
});

test("events: the public list and detail only ever return events added by a State admin", async () => {
  stub("event.findMany", async () => []);
  await call("GET", "/events");
  assert.deepEqual(called("event.findMany")[0].args[0].where.createdBy, { role: "STATE_ADMIN" });
  stub("event.findFirst", async () => null);
  assert.equal((await call("GET", "/events/anything")).status, 404);
  assert.deepEqual(called("event.findFirst")[0].args[0].where.createdBy, { role: "STATE_ADMIN" });
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

/* ---------------- units (State Committee only) ---------------- */
test("units: only the State Committee adds or deletes units", async () => {
  stub("district.findUnique", async () => ({ id: "D1" }));
  stub("unit.create", async ({ data }) => ({ id: "UN", ...data }));
  stub("unit.findUnique", async () => ({ id: "UN", name: "Test Unit", districtId: "D1", _count: { members: 0 } }));
  stub("unit.delete", async () => ({}));
  stub("auditLog.create", async () => ({}));
  const body = { districtId: "D1", name: "Fort Kochi Unit" };
  assert.equal((await call("POST", "/units", { as: district1, body })).status, 403, "district admin cannot add");
  assert.equal((await call("POST", "/units", { as: member1, body })).status, 403, "members can no longer propose units");
  assert.equal((await call("DELETE", "/units/UN", { as: district1 })).status, 403, "district admin cannot delete");
  assert.equal(called("unit.create").length + called("unit.delete").length, 0);
  const created = await call("POST", "/units", { as: state, body });
  assert.equal(created.status, 201);
  assert.equal(called("unit.create")[0].args[0].data.status, "APPROVED", "approved straight away");
  assert.equal((await call("DELETE", "/units/UN", { as: state })).status, 204);
  assert.equal(called("unit.delete").length, 1);
});

test("units: a unit that still has members cannot be deleted", async () => {
  stub("unit.findUnique", async () => ({ id: "UN", name: "Busy Unit", districtId: "D1", _count: { members: 3 } }));
  stub("unit.delete", async () => ({}));
  const r = await call("DELETE", "/units/UN", { as: state });
  assert.equal(r.status, 409);
  assert.match(r.json.error.message, /3 members/);
  assert.equal(called("unit.delete").length, 0);
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

test("news: only the State Committee posts or deletes; the site lists only State admin posts", async () => {
  stub("newsPost.create", async ({ data }) => ({ id: "n", ...data }));
  const post = { title: "Hello", body: "World", scope: "STATE", publishNow: true };
  assert.equal((await call("POST", "/news", { as: district1, body: post })).status, 403);
  assert.equal((await call("POST", "/news", { as: unit1, body: post })).status, 403);
  stub("newsPost.findUnique", async () => ({ id: "n2", districtId: "D1", authorId: "other", coverImageUrl: null }));
  stub("newsPost.delete", async () => ({ coverImageUrl: null }));
  assert.equal((await call("DELETE", "/news/n2", { as: district1 })).status, 403);
  assert.equal(called("newsPost.create").length + called("newsPost.delete").length, 0);
  assert.equal((await call("POST", "/news", { as: state, body: post })).status, 201);
  // public list only ever asks for posts written by a State admin
  stub("newsPost.findMany", async () => []);
  await call("GET", "/news");
  assert.deepEqual(called("newsPost.findMany")[0].args[0].where.author, { role: "STATE_ADMIN" });
  stub("newsPost.findFirst", async () => null);
  assert.equal((await call("GET", "/news/anything")).status, 404, "a non-State post is not served by id either");
  assert.deepEqual(called("newsPost.findFirst")[0].args[0].where.author, { role: "STATE_ADMIN" });
});

test("sponsors: only the State Committee adds, edits or deletes sponsors; district admins keep their own sponsorship log", async () => {
  stub("sponsor.create", async ({ data }) => ({ id: "s", ...data }));
  stub("sponsor.update", async () => ({})); stub("sponsor.delete", async () => ({}));
  stub("sponsor.findUnique", async () => ({ id: "s", districtId: "D1" }));
  for (const who of [district1, unit1]) {
    assert.equal((await call("POST", "/sponsors", { as: who, body: { name: "Acme Ltd" } })).status, 403);
    assert.equal((await call("PATCH", "/sponsors/s", { as: who, body: { name: "New name" } })).status, 403);
    assert.equal((await call("DELETE", "/sponsors/s", { as: who })).status, 403);
  }
  assert.equal(called("sponsor.create").length + called("sponsor.update").length + called("sponsor.delete").length, 0);
  assert.equal((await call("POST", "/sponsors", { as: state, body: { name: "Acme Ltd" } })).status, 201);
  // the district log is still scoped to the caller's own district
  assert.equal((await call("GET", "/sponsors/districts/D2/logs", { as: district1 })).status, 403);
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
