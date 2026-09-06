/* eslint-disable no-console */
// Minimal end-to-end check against a running API + seeded database.
//   1. start Postgres, set DATABASE_URL in .env
//   2. npm run setup        (migrate + generate + seed)
//   3. npm run dev           (in another terminal)
//   4. npm run smoke
const BASE = process.env.SMOKE_BASE || "http://localhost:4000";
const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@akdfa.org";
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || "akdfa-admin-2026";

let pass = 0;
let fail = 0;

async function check(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    fail++;
    console.log(`  FAIL ${name} — ${err.message}`);
  }
}

async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json.error || json)}`);
  return json;
}

(async () => {
  console.log(`Smoke testing ${BASE}\n`);

  await check("GET /health", async () => {
    const res = await fetch(`${BASE}/health`);
    if (!res.ok) throw new Error(`status ${res.status}`);
  });

  await check("GET /districts returns 17 units-worth of districts", async () => {
    const { districts } = await api("/districts");
    if (!Array.isArray(districts) || districts.length < 14) throw new Error(`got ${districts?.length}`);
  });

  await check("GET /units public list", async () => {
    const { units } = await api("/units");
    if (!units.length) throw new Error("no units");
  });

  let adminToken;
  await check("POST /auth/login (bootstrap admin)", async () => {
    const { accessToken } = await api("/auth/login", { method: "POST", body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    if (!accessToken) throw new Error("no accessToken");
    adminToken = accessToken;
  });

  await check("GET /auth/me", async () => {
    const { member } = await api("/auth/me", { token: adminToken });
    if (member.role !== "STATE_ADMIN") throw new Error(`role ${member.role}`);
  });

  await check("GET /reports/state-overview", async () => {
    const overview = await api("/reports/state-overview", { token: adminToken });
    if (typeof overview.totalMembers !== "number") throw new Error("bad shape");
  });

  const rnd = Date.now();
  let newMemberId;
  await check("POST /auth/register (new pending member)", async () => {
    const { units } = await api("/units");
    const { member } = await api("/auth/register", {
      method: "POST",
      body: { unitId: units[0].id, fullName: "Smoke Test", email: `smoke${rnd}@example.com`, phone: `+9198${rnd.toString().slice(-8)}`, password: "smoke-pass-123" },
    });
    newMemberId = member.id;
    if (member.status !== "PENDING") throw new Error(`status ${member.status}`);
  });

  await check("POST /members/:id/approve", async () => {
    const { member } = await api(`/members/${newMemberId}/approve`, { method: "POST", token: adminToken });
    if (member.status !== "ACTIVE") throw new Error(`status ${member.status}`);
  });

  await check("GET /store/products", async () => {
    const { products } = await api("/store/products");
    if (!products.length) throw new Error("no products");
  });

  await check("POST /notifications/broadcast", async () => {
    const { sent } = await api("/notifications/broadcast", {
      method: "POST",
      token: adminToken,
      body: { title: "Smoke", body: "test", category: "ANNOUNCEMENT" },
    });
    if (typeof sent !== "number") throw new Error("bad shape");
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
