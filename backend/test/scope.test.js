const test = require("node:test");
const assert = require("node:assert/strict");
const { canManage, assertCanManage, canViewMember } = require("../src/middleware/scope");

const state = { id: "s", role: "STATE_ADMIN" };
const dA = { id: "da", role: "DISTRICT_ADMIN", districtId: "D1", unitId: "U1" };
const uA = { id: "ua", role: "UNIT_ADMIN", districtId: "D1", unitId: "U1" };
const member = { id: "m", role: "MEMBER", districtId: "D1", unitId: "U1" };

test("state admin manages anything", () => {
  assert.equal(canManage(state, { districtId: "D9", unitId: "U9" }), true);
  assert.equal(canManage(state, {}), true);
});

test("district admin: own district yes, other district no, no district no", () => {
  assert.equal(canManage(dA, { districtId: "D1" }), true);
  assert.equal(canManage(dA, { districtId: "D2" }), false);
  assert.equal(canManage(dA, { unitId: "U1" }), false); // a unit id alone is not enough: callers must resolve the district
  assert.equal(canManage(dA, {}), false);
});

test("unit admin: own unit only", () => {
  assert.equal(canManage(uA, { districtId: "D1", unitId: "U1" }), true);
  assert.equal(canManage(uA, { districtId: "D1", unitId: "U2" }), false); // same district, other unit
  assert.equal(canManage(uA, { districtId: "D1" }), false); // district-level record
});

test("creators can manage their own records regardless of level", () => {
  assert.equal(canManage(uA, { districtId: "D2", unitId: "U9", ownerId: "ua" }), true);
  assert.equal(canManage(member, { ownerId: "m" }), true);
  assert.equal(canManage(member, { ownerId: "someone-else" }), false);
});

test("plain members and anonymous callers manage nothing they don't own", () => {
  assert.equal(canManage(member, { districtId: "D1", unitId: "U1" }), false);
  assert.equal(canManage(null, { districtId: "D1" }), false);
  assert.equal(canManage(undefined, {}), false);
});

test("assertCanManage throws a 403", () => {
  assert.throws(() => assertCanManage(dA, { districtId: "D2" }), (e) => e.statusCode === 403);
  assert.doesNotThrow(() => assertCanManage(dA, { districtId: "D1" }));
});

test("canViewMember: self, scoped admins, never a peer or other district", () => {
  const target = { id: "t", districtId: "D1", unitId: "U1" };
  assert.equal(canViewMember({ id: "t", role: "MEMBER" }, target), true);
  assert.equal(canViewMember(uA, target), true);
  assert.equal(canViewMember(dA, target), true);
  assert.equal(canViewMember(state, target), true);
  assert.equal(canViewMember(member, target), false);
  assert.equal(canViewMember(dA, { id: "t2", districtId: "D2", unitId: "U7" }), false);
  assert.equal(canViewMember(uA, { id: "t3", districtId: "D1", unitId: "U2" }), false);
});
