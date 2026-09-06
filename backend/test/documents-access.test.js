const test = require("node:test");
const assert = require("node:assert/strict");
const { documentListWhere, canReadDocument, canManageDocument } = require("../src/modules/admin/documents.access");

const state = { role: "STATE_ADMIN", districtId: "d-tvm" };
const dadm = { role: "DISTRICT_ADMIN", districtId: "d-ekm" };
const member = { role: "MEMBER", districtId: "d-ekm" };

test("list filter: anonymous sees only PUBLIC", () => {
  assert.deepEqual(documentListWhere(null), { visibility: "PUBLIC" });
});

test("list filter: state admin sees everything", () => {
  assert.deepEqual(documentListWhere(state), {});
});

test("list filter: district users see PUBLIC + own DISTRICT_ONLY", () => {
  assert.deepEqual(documentListWhere(dadm), {
    OR: [{ visibility: "PUBLIC" }, { visibility: "DISTRICT_ONLY", districtId: "d-ekm" }],
  });
});

test("STATE_ONLY does not leak to a district admin, even in their district", () => {
  assert.equal(canReadDocument({ visibility: "STATE_ONLY", districtId: "d-ekm" }, dadm), false);
  assert.equal(canReadDocument({ visibility: "STATE_ONLY", districtId: "d-ekm" }, state), true);
});

test("DISTRICT_ONLY visible only within its district", () => {
  assert.equal(canReadDocument({ visibility: "DISTRICT_ONLY", districtId: "d-ekm" }, member), true);
  assert.equal(canReadDocument({ visibility: "DISTRICT_ONLY", districtId: "d-tvm" }, member), false);
});

test("PUBLIC readable by anyone incl. anonymous", () => {
  assert.equal(canReadDocument({ visibility: "PUBLIC" }, null), true);
});

test("manage: district admin only within own district; state admin anywhere", () => {
  assert.equal(canManageDocument({ districtId: "d-ekm" }, dadm), true);
  assert.equal(canManageDocument({ districtId: "d-tvm" }, dadm), false);
  assert.equal(canManageDocument({ districtId: null }, state), true);
  assert.equal(canManageDocument({ districtId: "d-ekm" }, member), false);
});
