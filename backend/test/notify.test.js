process.env.ENCRYPTION_KEY = "0".repeat(64);
const test = require("node:test");
const assert = require("node:assert/strict");

// Stub the shared prisma client before notify.service pulls it in.
const prisma = require("../src/config/prisma");
let prefRows = [];
let created = [];
prisma.notificationPreference.findMany = async ({ where }) => prefRows.filter((r) => where.memberId.in.includes(r.memberId) && r.category === where.category);
prisma.notification.createMany = async ({ data }) => {
  created.push(...data);
  return { count: data.length };
};

const { notify } = require("../src/modules/notifications/notify.service");

test.beforeEach(() => {
  prefRows = [];
  created = [];
});

test("no preference rows → everyone gets it", async () => {
  const sent = await notify(["a", "b"], { title: "T", body: "B", category: "NEWS" });
  assert.equal(sent, 2);
  assert.equal(created.length, 2);
});

test("member with all channels disabled for the category is skipped", async () => {
  prefRows = [
    { memberId: "a", category: "NEWS", enabled: false },
    { memberId: "a", category: "NEWS", enabled: false },
    { memberId: "b", category: "NEWS", enabled: true },
  ];
  const sent = await notify(["a", "b"], { title: "T", body: "B", category: "NEWS" });
  assert.equal(sent, 1);
  assert.deepEqual(created.map((c) => c.memberId), ["b"]);
});

test("member with at least one channel enabled still gets it", async () => {
  prefRows = [
    { memberId: "a", category: "EVENT", enabled: false },
    { memberId: "a", category: "EVENT", enabled: true },
  ];
  assert.equal(await notify("a", { title: "T", body: "B", category: "EVENT" }), 1);
});

test("force:true ignores preferences", async () => {
  prefRows = [{ memberId: "a", category: "PAYMENT", enabled: false }];
  assert.equal(await notify("a", { title: "T", body: "B", category: "PAYMENT", force: true }), 1);
});

test("de-dupes ids and ignores falsy", async () => {
  await notify(["a", "a", null, undefined], { title: "T", body: "B", category: "NEWS" });
  assert.equal(created.length, 1);
});
