// Runs the real Express app against a stubbed Prisma client. The DB URL points at a closed local port so an
// un-stubbed query fails fast instead of ever reaching a real database.
process.env.NODE_ENV = "test";
process.env.ENCRYPTION_KEY = "0".repeat(64);
process.env.DATABASE_URL = "postgresql://nobody:nobody@127.0.0.1:1/none?connection_limit=1&connect_timeout=1";
process.env.AUTH_RATE_LIMIT_MAX = "100000";

const http = require("http");
const app = require("../../src/app");
const prisma = require("../../src/config/prisma");
const { signAccessToken } = require("../../src/utils/jwt");

let server, base;
const restores = [];

async function start() {
  if (server) return;
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
}
async function stop() {
  if (server) await new Promise((r) => server.close(r));
  server = null;
}

// stub("event.update", async (args) => ({...})) — recorded in calls[]; restored by reset().
const calls = [];
function stub(path, fn) {
  const [model, method] = path.split(".");
  const target = model === "$transaction" ? prisma : prisma[model];
  const key = model === "$transaction" ? "$transaction" : method;
  const original = target[key];
  target[key] = async (...args) => { calls.push({ path, args }); return fn(...args); };
  restores.push(() => { target[key] = original; });
}
function reset() { while (restores.length) restores.pop()(); calls.length = 0; }
const called = (path) => calls.filter((c) => c.path === path);

// People used across the tests. D1/U1 is "home"; D2/U2 is somewhere else.
const people = {
  state: { id: "state1", role: "STATE_ADMIN", districtId: "D1", unitId: "U1" },
  district1: { id: "dadmin1", role: "DISTRICT_ADMIN", districtId: "D1", unitId: "U1" },
  unit1: { id: "uadmin1", role: "UNIT_ADMIN", districtId: "D1", unitId: "U1" },
  unit1b: { id: "uadmin1b", role: "UNIT_ADMIN", districtId: "D1", unitId: "U1B" },
  member1: { id: "member1", role: "MEMBER", districtId: "D1", unitId: "U1" },
};
const bearer = (p) => "Bearer " + signAccessToken(p);

async function call(method, path, { as, body } = {}) {
  await start();
  const res = await fetch(base + "/api/v1" + path, {
    method,
    headers: { "content-type": "application/json", ...(as ? { authorization: bearer(as) } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await res.json(); } catch (_) { /* 204 etc. */ }
  return { status: res.status, json };
}

module.exports = { call, stub, reset, called, people, stop, prisma };
