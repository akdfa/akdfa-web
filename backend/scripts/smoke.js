/* eslint-disable no-console */
// Minimal end-to-end check against a running API + seeded database.
//   1. start Postgres, set DATABASE_URL in .env
//   2. npm run setup        (migrate + generate + seed)
//   3. npm run dev           (in another terminal)
//   4. npm run smoke
try { require("../src/config/env"); } catch (_) {}
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

  let docId;
  await check("POST /admin/documents (multipart) + audit", async () => {
    const fd = new FormData();
    fd.append("file", new Blob(["AKDFA smoke bylaw"], { type: "text/plain" }), "bylaw.txt");
    fd.append("title", `Smoke Bylaw ${rnd}`);
    fd.append("type", "BYLAW");
    fd.append("visibility", "PUBLIC");
    const res = await fetch(`${BASE}/api/v1/admin/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: fd,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(json.error));
    if (json.document.fileKey) throw new Error("fileKey leaked to client");
    docId = json.document.id;
    const { logs } = await api(`/admin/audit-logs?entityType=Document&entityId=${docId}`, { token: adminToken });
    if (!logs.some((l) => l.action === "DOCUMENT_UPLOADED")) throw new Error("no audit entry");
  });

  await check("GET /public/documents/:id/file streams the PUBLIC doc", async () => {
    const res = await fetch(`${BASE}/api/v1/public/documents/${docId}/file`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = await res.text();
    if (body !== "AKDFA smoke bylaw") throw new Error("file content mismatch");
  });

  await check("STATE_ONLY doc is not downloadable without a token", async () => {
    const fd = new FormData();
    fd.append("file", new Blob(["secret minutes"], { type: "text/plain" }), "m.txt");
    fd.append("title", `Smoke Minutes ${rnd}`);
    fd.append("type", "MINUTES");
    fd.append("visibility", "STATE_ONLY");
    const up = await fetch(`${BASE}/api/v1/admin/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: fd,
    }).then((r) => r.json());
    const anon = await fetch(`${BASE}/api/v1/admin/documents/${up.document.id}/file`);
    if (anon.status !== 403 && anon.status !== 401) throw new Error(`expected 403, got ${anon.status}`);
  });

  await check("DELETE /admin/documents/:id", async () => {
    const res = await fetch(`${BASE}/api/v1/admin/documents/${docId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.status !== 204) throw new Error(`status ${res.status}`);
  });

  await check("GET /districts/:id/showcase", async () => {
    const { districts } = await api("/districts");
    const s = await api(`/districts/${districts[0].id}/showcase`);
    if (!s.district || !Array.isArray(s.upcomingEvents)) throw new Error("bad shape");
  });

  await check("GET /reports/trends", async () => {
    const t = await api("/reports/trends", { token: adminToken });
    if (!Array.isArray(t.series) || t.series.length !== 12) throw new Error(`series ${t.series?.length}`);
  });

  await check("feedback round-trip (member → admin → reply)", async () => {
    // sign in as the member we just approved
    const { accessToken } = await api("/auth/login", {
      method: "POST",
      body: { email: `smoke${rnd}@example.com`, password: "smoke-pass-123" },
    });
    const { feedback } = await api("/feedback", {
      method: "POST",
      token: accessToken,
      body: { subject: "Smoke check", message: "Testing the feedback channel." },
    });
    const inbox = await api("/feedback", { token: adminToken });
    if (!inbox.feedback.some((f) => f.id === feedback.id)) throw new Error("not in admin inbox");
    await api(`/feedback/${feedback.id}`, { method: "PATCH", token: adminToken, body: { response: "Got it, thanks.", status: "RESOLVED" } });
    const mine = await api("/feedback/me", { token: accessToken });
    if (mine.feedback[0].response !== "Got it, thanks.") throw new Error("reply not visible to member");
  });

  await check("District admin broadcast is district-scoped", async () => {
    // bootstrap admin is STATE_ADMIN so this just checks the endpoint accepts it
    const { sent, scope } = await api("/notifications/broadcast", {
      method: "POST",
      token: adminToken,
      body: { title: "Scope test", body: "x", districtId: (await api("/districts")).districts[0].id },
    });
    if (scope !== "district" || typeof sent !== "number") throw new Error("bad scope");
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
