/*
 * AKDFA API client — shared by the public site and the member/committee portal.
 *
 * Base URL resolution order:
 *   1. localStorage "akdfa.apiBase"  (set once on a device, e.g. a staging URL)
 *   2. window.AKDFA_API_BASE          (inline <script> override per page)
 *   3. same host on :4000 when the site is served over http(s)
 *   4. http://localhost:4000          (file:// / fallback)
 */
(function (global) {
  "use strict";

  function resolveBase() {
    try {
      const stored = localStorage.getItem("akdfa.apiBase");
      if (stored) return stored.replace(/\/$/, "");
    } catch (_) {}
    if (global.AKDFA_API_BASE) return String(global.AKDFA_API_BASE).replace(/\/$/, "");
    const loc = global.location;
    if (loc && /^https?:$/.test(loc.protocol)) {
      return `${loc.protocol}//${loc.hostname}:4000`;
    }
    return "http://localhost:4000";
  }

  const BASE = resolveBase();
  const API = BASE + "/api/v1";

  const store = {
    get access() {
      try { return localStorage.getItem("akdfa.access"); } catch (_) { return null; }
    },
    get refresh() {
      try { return localStorage.getItem("akdfa.refresh"); } catch (_) { return null; }
    },
    get member() {
      try { return JSON.parse(localStorage.getItem("akdfa.member") || "null"); } catch (_) { return null; }
    },
    set(session) {
      try {
        if (session.accessToken) localStorage.setItem("akdfa.access", session.accessToken);
        if (session.refreshToken) localStorage.setItem("akdfa.refresh", session.refreshToken);
        if (session.member) localStorage.setItem("akdfa.member", JSON.stringify(session.member));
      } catch (_) {}
    },
    clear() {
      try {
        localStorage.removeItem("akdfa.access");
        localStorage.removeItem("akdfa.refresh");
        localStorage.removeItem("akdfa.member");
      } catch (_) {}
    },
  };

  class ApiError extends Error {
    constructor(status, message, details) {
      super(message || "Request failed");
      this.status = status;
      this.details = details;
    }
  }

  let refreshing = null;

  async function tryRefresh() {
    if (!store.refresh) return false;
    if (!refreshing) {
      refreshing = fetch(API + "/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: store.refresh }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((data) => {
          store.set(data);
          return true;
        })
        .catch(() => {
          store.clear();
          return false;
        })
        .finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function request(path, { method = "GET", body, auth = true, isForm = false, retry = true } = {}) {
    const headers = {};
    if (!isForm) headers["Content-Type"] = "application/json";
    if (auth && store.access) headers.Authorization = "Bearer " + store.access;

    let res;
    try {
      res = await fetch(API + path, {
        method,
        headers,
        body: isForm ? body : body != null ? JSON.stringify(body) : undefined,
      });
    } catch (netErr) {
      throw new ApiError(0, "Cannot reach the AKDFA server. Is the API running?");
    }

    if (res.status === 401 && auth && retry && store.refresh) {
      const ok = await tryRefresh();
      if (ok) return request(path, { method, body, auth, isForm, retry: false });
    }

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const err = data && data.error ? data.error : {};
      throw new ApiError(res.status, err.message || res.statusText, err.details);
    }
    return data;
  }

  const api = {
    BASE,
    API,
    ApiError,
    session: store,
    isLoggedIn: () => !!store.access,
    currentMember: () => store.member,

    get: (p) => request(p),
    post: (p, body, opts) => request(p, { method: "POST", body, ...(opts || {}) }),
    patch: (p, body) => request(p, { method: "PATCH", body }),
    put: (p, body) => request(p, { method: "PUT", body }),
    del: (p) => request(p, { method: "DELETE" }),
    publicPost: (p, body) => request(p, { method: "POST", body, auth: false }),

    async login(email, password) {
      const data = await request("/auth/login", { method: "POST", body: { email, password }, auth: false });
      store.set(data);
      return data.member;
    },
    async register(payload) {
      return request("/auth/register", { method: "POST", body: payload, auth: false });
    },
    async logout() {
      try {
        if (store.refresh) await request("/auth/logout", { method: "POST", body: { refreshToken: store.refresh }, auth: false });
      } catch (_) {}
      store.clear();
    },
    async me() {
      const { member } = await request("/auth/me");
      store.set({ member });
      return member;
    },
    async upload(file) {
      const fd = new FormData();
      fd.append("file", file);
      const { url } = await request("/uploads", { method: "POST", body: fd, isForm: true });
      return url;
    },
    setApiBase(url) {
      try { localStorage.setItem("akdfa.apiBase", String(url).replace(/\/$/, "")); } catch (_) {}
    },
  };

  global.AKDFA = api;
})(window);
