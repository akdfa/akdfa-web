/* =====================================================================
 * AKDFA Member & Committee Portal  (Phases 2–5)
 * Single-page app over the AKDFA API. Hash-routed, role-aware.
 * ===================================================================== */
(function () {
  "use strict";
  const api = window.AKDFA;
  const RANK = { MEMBER: 0, UNIT_ADMIN: 1, DISTRICT_ADMIN: 2, STATE_ADMIN: 3 };

  /* ---- tiny helpers ------------------------------------------------ */
  const $ = (s, r) => (r || document).querySelector(s);
  const view = () => $("#portalView");
  const esc = (v) =>
    String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const titleCase = (s) => String(s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const fmtDate = (d, opts) =>
    d ? new Date(d).toLocaleDateString("en-IN", opts || { day: "numeric", month: "short", year: "numeric" }) : "—";
  const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
  const daysUntil = (d) => Math.ceil((new Date(d) - Date.now()) / 86400000);

  let me = null; // current member
  let districtsCache = null;
  let _cardVerifyUrl = null;

  // Load an external script once; resolve true when its global is available.
  const _scripts = {};
  function loadScript(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(true);
    if (_scripts[src]) return _scripts[src];
    _scripts[src] = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
    return _scripts[src];
  }

  function can(role) {
    return me && RANK[me.role] >= RANK[role];
  }
  async function districts() {
    if (!districtsCache) districtsCache = (await api.get("/districts")).districts;
    return districtsCache;
  }

  function toast(msg, kind) {
    let t = $("#portalToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "portalToast";
      t.style.cssText =
        "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:80;padding:12px 20px;border-radius:12px;font-weight:800;font-size:.9rem;border:1px solid var(--border);background:#141414;color:#fff;box-shadow:var(--shadow);max-width:90vw;text-align:center";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.borderColor = kind === "error" ? "rgba(242,117,117,.6)" : kind === "ok" ? "rgba(47,155,97,.6)" : "var(--border)";
    t.style.opacity = "1";
    clearTimeout(toast._h);
    toast._h = setTimeout(() => (t.style.opacity = "0"), 3200);
  }

  const busy = (btn, on, label) => {
    if (!btn) return;
    btn.disabled = on;
    if (on) {
      btn.dataset._t = btn.textContent;
      btn.textContent = label || "Working…";
    } else if (btn.dataset._t) btn.textContent = btn.dataset._t;
  };

  /* form serialiser: reads [name] inputs inside a container */
  function readForm(root) {
    const out = {};
    root.querySelectorAll("[name]").forEach((i) => {
      if (i.type === "checkbox") out[i.name] = i.checked;
      else if (i.type === "number") out[i.name] = i.value === "" ? undefined : Number(i.value);
      else out[i.name] = i.value.trim() === "" ? undefined : i.value.trim();
    });
    return out;
  }

  /* ---- Razorpay checkout ----------------------------------------- */
  function loadRazorpay() {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }
  async function payWithRazorpay(order, onVerified) {
    if (!order.keyId) {
      toast("Payments aren't configured on the server yet.", "error");
      return;
    }
    const ok = await loadRazorpay();
    if (!ok) return toast("Couldn't load the payment window.", "error");
    const rz = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency || "INR",
      name: "AKDFA",
      description: order.description || "AKDFA payment",
      order_id: order.orderId,
      prefill: { name: me.fullName, email: me.email, contact: me.phone },
      theme: { color: "#d4af37" },
      handler: async (resp) => {
        try {
          await api.post("/payments/verify", {
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          });
          toast("Payment successful", "ok");
          onVerified && onVerified();
        } catch (e) {
          toast("Payment captured but verification failed: " + e.message, "error");
        }
      },
    });
    rz.open();
  }

  /* ---- navigation config --------------------------------------- */
  const NAV = [
    { group: "Membership", items: [
      ["#/", "Dashboard", "fa-gauge-high"],
      ["#/card", "Digital Card", "fa-id-card"],
      ["#/profile", "Profile & Badges", "fa-user"],
      ["#/membership", "Membership Fee", "fa-receipt"],
    ]},
    { group: "Community", items: [
      ["#/feed", "News Feed", "fa-newspaper"],
      ["#/events", "Events", "fa-calendar-days"],
      ["#/polls", "Polls", "fa-square-poll-vertical"],
      ["#/feedback", "Feedback", "fa-comment-dots"],
      ["#/notifications", "Notifications", "fa-bell"],
    ]},
    { group: "Cricket", items: [
      ["#/cricket", "Cricket Hub", "fa-baseball"],
    ]},
    { group: "Store", items: [
      ["#/store", "AKDFA Store", "fa-shirt"],
      ["#/orders", "My Orders", "fa-box"],
    ]},
    { group: "Committee", role: "UNIT_ADMIN", items: [
      ["#/admin/members", "Members", "fa-users", "UNIT_ADMIN"],
      ["#/admin/feedback", "Feedback Inbox", "fa-inbox", "UNIT_ADMIN"],
      ["#/admin/cricket", "Manage Cricket", "fa-clipboard-list", "UNIT_ADMIN"],
      ["#/admin/content", "News / Events / Polls", "fa-pen-nib", "UNIT_ADMIN"],
      ["#/admin/broadcast", "Broadcast", "fa-tower-broadcast", "DISTRICT_ADMIN"],
      ["#/admin/units", "Units", "fa-sitemap", "DISTRICT_ADMIN"],
      ["#/admin/sponsors", "Sponsors & Logs", "fa-handshake", "DISTRICT_ADMIN"],
      ["#/admin/orders", "Store Orders", "fa-box-open", "DISTRICT_ADMIN"],
      ["#/admin/reports", "District Report", "fa-file-lines", "DISTRICT_ADMIN"],
      ["#/admin/documents", "Documents", "fa-folder-open", "DISTRICT_ADMIN"],
    ]},
    { group: "State Committee", role: "STATE_ADMIN", items: [
      ["#/admin/overview", "State Overview", "fa-chart-line", "STATE_ADMIN"],
      ["#/admin/all-reports", "District Reports", "fa-folder-tree", "STATE_ADMIN"],
      ["#/admin/roles", "Roles & Audit", "fa-user-shield", "STATE_ADMIN"],
      ["#/admin/store-admin", "Store Products", "fa-tags", "STATE_ADMIN"],
    ]},
  ];

  function buildNav() {
    const nav = $("#portalNav");
    nav.innerHTML = NAV.filter((g) => !g.role || can(g.role))
      .map((g) => {
        const items = g.items
          .filter((it) => !it[3] || can(it[3]))
          .map(([href, label, icon]) => `<a href="${href}"><i class="fa-solid ${icon}"></i>${label}</a>`)
          .join("");
        if (!items) return "";
        return `<div class="nav-group-label">${g.group}</div>${items}`;
      })
      .join("");
  }

  function setActiveNav() {
    const h = "#" + parseHash();
    $("#portalNav").querySelectorAll("a").forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("href") === h);
    });
  }

  /* ================================================================
   * ROUTES
   * ============================================================== */
  const routes = {};
  const R = (path, title, opts) => (routes[path] = Object.assign({ title }, opts));

  /* ---------- Dashboard ---------- */
  R("/", "Dashboard", {
    render: async () => {
      let d;
      try {
        d = await api.get("/members/me/dashboard");
      } catch (e) {
        d = { member: me, badges: [], referrals: [], unreadNotifications: 0, upcomingEvents: [], latestFee: null };
      }
      const m = d.member;
      const statusPill =
        m.status === "ACTIVE" ? '<span class="pill pill--ok">Active</span>'
        : m.status === "PENDING" ? '<span class="pill pill--warn">Awaiting approval</span>'
        : `<span class="pill pill--bad">${titleCase(m.status)}</span>`;
      const expiryNote =
        m.membershipExpiresAt && daysUntil(m.membershipExpiresAt) < 45
          ? `<div class="card"><strong>Your membership expires ${fmtDate(m.membershipExpiresAt)}</strong><p class="card-muted">Renew from the Membership Fee page to keep your digital card active.</p><a class="btn btn-primary btn-small" href="#/membership">Renew now</a></div>`
          : "";
      return `
        <div class="pv-head"><h1>Welcome, ${esc(m.fullName.split(" ")[0])}</h1><p>Member ${esc(m.memberNumber)} · ${esc(m.district?.name || "")} · ${esc(m.unit?.name || "")}</p></div>
        <div class="grid grid-4">
          <div class="stat"><span>Status</span><strong style="font-size:1rem">${statusPill}</strong></div>
          <div class="stat"><span>Badges</span><strong>${d.badges.length}</strong></div>
          <div class="stat"><span>Referrals</span><strong>${d.referrals.length}</strong></div>
          <div class="stat"><span>Unread</span><strong>${d.unreadNotifications}</strong></div>
        </div>
        ${expiryNote}
        <div class="grid grid-2" style="margin-top:16px">
          <div class="card">
            <div class="row-between"><h2>Upcoming events you're attending</h2><a class="btn-ghost btn-small" href="#/events">All events</a></div>
            <div class="list" style="margin-top:12px">
              ${d.upcomingEvents.length ? d.upcomingEvents.map((e) => `
                <div class="list-item"><div class="li-main"><strong>${esc(e.title)}</strong><small>${fmtDate(e.startsAt)} · ${esc(e.location || titleCase(e.type))}</small></div><span class="pill">${titleCase(e.rsvp)}</span></div>`).join("")
                : '<p class="card-muted">No RSVPs yet — browse the events calendar.</p>'}
            </div>
          </div>
          <div class="card">
            <div class="row-between"><h2>Your digital card</h2><a class="btn-ghost btn-small" href="#/card">Open</a></div>
            ${miniCard(m)}
          </div>
        </div>`;
    },
  });

  function miniCard(m) {
    const inactive = m.status !== "ACTIVE";
    return `<div class="mcard ${inactive ? "mcard--inactive" : ""}" style="margin-top:12px">
      <div class="mcard-top"><img src="assets/akdfa-circle-logo.png" alt=""><div class="mcard-org">AKDFA<br><span style="font-weight:600;opacity:.8">Reg 949/17</span></div></div>
      <div class="mcard-name">${esc(m.fullName)}</div>
      <div class="mcard-role">${titleCase(m.role)}</div>
      <div class="mcard-grid">
        <div><span>Member No.</span><strong>${esc(m.memberNumber)}</strong></div>
        <div><span>District</span><strong>${esc(m.district?.name || "—")}</strong></div>
        <div><span>Unit</span><strong>${esc(m.unit?.name || "—")}</strong></div>
        <div><span>Valid till</span><strong>${m.membershipExpiresAt ? fmtDate(m.membershipExpiresAt) : "—"}</strong></div>
      </div>
      ${inactive ? '<div style="position:relative;z-index:1;margin-top:14px;font-weight:800">Card activates once your membership is approved &amp; paid.</div>' : ""}
    </div>`;
  }

  /* ---------- Digital card ---------- */
  R("/card", "Digital Card", {
    render: async () => {
      let card = null;
      try {
        const r = await api.get(`/members/${me.id}/card`);
        card = r.card;
        _cardVerifyUrl = card.verifyUrl;
      } catch (e) {
        /* not active */
      }
      if (!card) {
        return `<div class="pv-head"><h1>Digital Card</h1></div>${miniCard(me)}
          <div class="card" style="margin-top:16px"><p class="card-muted">Your card becomes valid when your membership is <strong>ACTIVE</strong>. If you've just registered, ask your unit admin to approve you; if your membership lapsed, renew it from the Membership Fee page.</p></div>`;
      }
      return `
        <div class="pv-head"><h1>Digital Membership Card</h1><p>Show this at events like a boarding pass.</p></div>
        <div class="mcard">
          <div class="mcard-top"><img src="assets/akdfa-circle-logo.png" alt=""><div class="mcard-org">AKDFA<br><span style="font-weight:600;opacity:.8">Reg 949/17</span></div></div>
          <div class="mcard-name">${esc(card.fullName)}</div>
          <div class="mcard-role">${titleCase(card.role)}</div>
          <div class="mcard-grid">
            <div><span>Member No.</span><strong>${esc(card.memberNumber)}</strong></div>
            <div><span>District</span><strong>${esc(card.district)}</strong></div>
            <div><span>Unit</span><strong>${esc(card.unit)}</strong></div>
            <div><span>Valid till</span><strong>${card.expiresAt ? fmtDate(card.expiresAt) : "—"}</strong></div>
          </div>
        </div>
        <div class="card" style="margin-top:16px;max-width:460px;text-align:center">
          <div id="qrbox" style="display:inline-block;padding:12px;background:#fff;border-radius:12px"></div>
          <p class="card-muted" style="margin-top:10px">Gate staff scan this to verify · ${esc(card.memberNumber)}</p>
        </div>`;
    },
    after: async () => {
      const box = $("#qrbox");
      const url = _cardVerifyUrl || `${location.origin}/verify.html`;
      if (!box) return;
      const ok = await loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js", "QRCode");
      if (ok && window.QRCode) {
        box.innerHTML = "";
        new window.QRCode(box, { text: url, width: 176, height: 176, correctLevel: window.QRCode.CorrectLevel.M });
      } else {
        box.innerHTML = `<div style="font-family:monospace;letter-spacing:.2em;color:#111;font-weight:800">${esc(me.memberNumber)}</div>`;
      }
    },
  });

  /* ---------- Feed ---------- */
  R("/feed", "News Feed", {
    render: async () => {
      const { posts } = await api.get("/news?districtId=" + encodeURIComponent(me.districtId || ""));
      return `
        <div class="pv-head"><h1>News Feed</h1><p>State announcements and news from ${esc(me.district?.name || "your district")}.</p></div>
        ${posts.length ? `<div class="list">${posts.map(feedCard).join("")}</div>` : '<div class="empty">No posts yet.</div>'}`;
    },
  });
  function feedCard(p) {
    return `<article class="card">
      <div class="row" style="gap:8px;margin-bottom:6px">
        <span class="pill">${titleCase(p.scope)}</span>
        ${p.district ? `<span class="pill">${esc(p.district.name)}</span>` : ""}
        <span class="spacer"></span><small class="card-muted">${fmtDate(p.publishedAt)}</small>
      </div>
      <h2>${esc(p.title)}</h2>
      ${p.coverImageUrl ? `<img src="${esc(p.coverImageUrl)}" alt="" style="border-radius:12px;margin:10px 0;max-height:280px;object-fit:cover;width:100%">` : ""}
      <p style="white-space:pre-wrap">${esc(p.body)}</p>
      <small class="card-muted">— ${esc(p.author?.fullName || "AKDFA")}</small>
    </article>`;
  }

  /* ---------- Events ---------- */
  R("/events", "Events", {
    render: async () => {
      const ds = await districts();
      return `
        <div class="pv-head"><h1>Events Calendar</h1><p>Tournaments, charity drives, meetings and matches.</p></div>
        <div class="row" style="margin-bottom:16px">
          <select id="evtDistrict" class="btn-ghost"><option value="">All districts</option>${ds.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select>
          <select id="evtType" class="btn-ghost">
            <option value="">All types</option>${["TOURNAMENT", "CHARITY", "MATCH", "MEETING", "TRIAL", "OTHER"].map((t) => `<option>${t}</option>`).join("")}
          </select>
        </div>
        <div id="evtList" class="list"><div class="empty">Loading…</div></div>`;
    },
    after: () => {
      const load = async () => {
        const dId = $("#evtDistrict").value;
        const t = $("#evtType").value;
        const q = new URLSearchParams({ from: new Date(Date.now() - 30 * 86400000).toISOString() });
        if (dId) q.set("districtId", dId);
        if (t) q.set("type", t);
        const { events } = await api.get("/events?" + q.toString());
        $("#evtList").innerHTML = events.length
          ? events.map(eventRow).join("")
          : '<div class="empty">No events match.</div>';
      };
      $("#evtDistrict").onchange = load;
      $("#evtType").onchange = load;
      load();
    },
  });
  function eventRow(e) {
    const past = new Date(e.startsAt) < Date.now();
    return `<div class="card" data-evt="${e.id}">
      <div class="row-between">
        <div class="li-main">
          <div class="row" style="gap:8px"><span class="pill">${titleCase(e.type)}</span>${past ? '<span class="pill">Past</span>' : ""}</div>
          <h2 style="margin:8px 0 2px">${esc(e.title)}</h2>
          <small class="card-muted">${fmtDateTime(e.startsAt)}${e.location ? " · " + esc(e.location) : ""} · ${e._count?.rsvps || 0} going/interested</small>
          ${e.description ? `<p style="margin-top:8px">${esc(e.description)}</p>` : ""}
        </div>
      </div>
      ${past ? "" : `<div class="row" style="margin-top:12px">
        <button class="btn-ghost btn-small" data-act="rsvp" data-id="${e.id}" data-status="GOING">Going</button>
        <button class="btn-ghost btn-small" data-act="rsvp" data-id="${e.id}" data-status="INTERESTED">Interested</button>
        <button class="btn-ghost btn-small" data-act="rsvp" data-id="${e.id}" data-status="NOT_GOING">Can't go</button>
      </div>`}
    </div>`;
  }

  /* ---------- Polls ---------- */
  R("/polls", "Polls", {
    render: async () => {
      const { polls } = await api.get("/polls");
      if (!polls.length) return `<div class="pv-head"><h1>Polls</h1></div><div class="empty">No polls right now.</div>`;
      return `<div class="pv-head"><h1>Polls</h1><p>Have your say — one vote per poll, change it any time.</p></div>
        <div class="stack">${polls.map(pollCard).join("")}</div>`;
    },
  });
  function pollCard(p) {
    const total = p.totalVotes || 0;
    return `<div class="card">
      <h2>${esc(p.question)}</h2>
      <small class="card-muted">${total} vote${total === 1 ? "" : "s"}${p.closesAt ? " · closes " + fmtDate(p.closesAt) : ""}</small>
      <div class="stack" style="margin-top:12px">
        ${p.options.map((o) => {
          const c = o._count.votes;
          const pct = total ? Math.round((c / total) * 100) : 0;
          const mine = p.myOptionId === o.id;
          return `<div class="poll-option ${mine ? "is-mine" : ""}" data-act="vote" data-id="${o.id}">
            <div class="poll-bar"><div class="poll-bar-fill" style="width:${pct}%"></div>
            <div class="poll-bar-label"><span>${esc(o.label)}${mine ? " ✓" : ""}</span><span>${pct}%</span></div></div>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }

  /* ---------- Cricket hub ---------- */
  R("/cricket", "Cricket Hub", {
    render: async () => {
      const [{ teams }, { matches }, { trials }] = await Promise.all([
        api.get("/cricket/teams"),
        api.get("/cricket/matches"),
        api.get("/cricket/trials"),
      ]);
      const upcoming = matches.filter((m) => new Date(m.scheduledAt) >= Date.now() || m.status === "SCHEDULED").slice(0, 8);
      const recent = matches.filter((m) => m.status === "COMPLETED").slice(0, 6);
      const openTrials = trials.filter((t) => new Date(t.scheduledAt) >= Date.now());
      return `
        <div class="pv-head"><h1>Cricket Hub</h1><p>Teams, fixtures, results and trials across AKDFA.</p></div>
        <div class="pv-tabs">
          <button class="is-active" data-tab="teams">Teams</button>
          <button data-tab="fixtures">Fixtures</button>
          <button data-tab="results">Results</button>
          <button data-tab="trials">Trials</button>
        </div>
        <div data-panel="teams">${teams.length ? `<div class="grid grid-2">${teams.map(teamCard).join("")}</div>` : '<div class="empty">No teams registered yet.</div>'}</div>
        <div data-panel="fixtures" hidden>${upcoming.length ? `<div class="list">${upcoming.map(matchRow).join("")}</div>` : '<div class="empty">No upcoming matches.</div>'}</div>
        <div data-panel="results" hidden>${recent.length ? `<div class="list">${recent.map(matchRow).join("")}</div>` : '<div class="empty">No results posted.</div>'}</div>
        <div data-panel="trials" hidden>${openTrials.length ? `<div class="list">${openTrials.map(trialRow).join("")}</div>` : '<div class="empty">No open trials.</div>'}</div>`;
    },
    after: () => {
      view().querySelectorAll(".pv-tabs button").forEach((b) => {
        b.onclick = () => {
          view().querySelectorAll(".pv-tabs button").forEach((x) => x.classList.toggle("is-active", x === b));
          view().querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
        };
      });
    },
  });
  function teamCard(t) {
    return `<div class="card"><h2>${esc(t.name)}</h2>
      <small class="card-muted">Season ${esc(t.season)} · ${t._count?.players || 0} players · Captain: ${esc(t.captain?.fullName || "—")}</small>
      <div style="margin-top:10px"><a class="btn-ghost btn-small" data-act="team" data-id="${t.id}">View roster</a></div></div>`;
  }
  function matchRow(m) {
    return `<div class="list-item"><div class="li-main">
      <strong>${esc(m.homeTeam?.name || "TBD")} vs ${esc(m.awayTeam?.name || "TBD")}</strong>
      <small>${fmtDateTime(m.scheduledAt)}${m.venue ? " · " + esc(m.venue) : ""}${m.resultSummary ? " · " + esc(m.resultSummary) : ""}</small>
      </div>
      ${m.status === "SCHEDULED" ? `<button class="btn-ghost btn-small" data-act="predict" data-id="${m.id}" data-home="${m.homeTeamId}" data-away="${m.awayTeamId}" data-hn="${esc(m.homeTeam?.name)}" data-an="${esc(m.awayTeam?.name)}">Predict</button>`
        : `<span class="pill">${titleCase(m.status)}</span>`}
    </div>`;
  }
  function trialRow(t) {
    return `<div class="list-item"><div class="li-main"><strong>Trial · ${fmtDate(t.scheduledAt)}</strong><small>${esc(t.location || "Venue TBA")}${t.description ? " · " + esc(t.description) : ""}</small></div>
      <button class="btn-ghost btn-small" data-act="applyTrial" data-id="${t.id}">Put my name forward</button></div>`;
  }

  /* ---------- Store ---------- */
  R("/store", "AKDFA Store", {
    render: async () => {
      const { products } = await api.get("/store/products");
      return `<div class="pv-head"><h1>AKDFA Store</h1><p>Official merchandise — member pricing applied at checkout.</p></div>
        ${products.length ? `<div class="grid grid-3" id="prodGrid">${products.map(productCard).join("")}</div>` : '<div class="empty">The store is being stocked.</div>'}
        <div class="card" id="cartCard" style="margin-top:18px" hidden><h2>Your bag</h2><div id="cartLines"></div>
          <label class="pv-form" style="margin-top:10px">Shipping address<textarea id="shipAddr" name="shippingAddress" placeholder="Name, street, city, PIN, phone"></textarea></label>
          <button class="btn btn-primary" data-act="checkout" style="margin-top:10px">Checkout</button></div>`;
    },
    after: () => wireStore(),
  });

  const cart = {};
  function productCard(p) {
    const price = p.displayPrice != null ? p.displayPrice : p.memberPrice;
    return `<div class="card">
      ${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="" style="width:100%;height:150px;object-fit:cover;border-radius:10px;margin-bottom:10px">` : ""}
      <h3>${esc(p.name)}</h3>
      <small class="card-muted">${esc(p.description || titleCase(p.category))}</small>
      <div class="row-between" style="margin-top:8px"><strong>${money(price)}</strong>
        ${p.sizesAvailable?.length ? `<select class="btn-ghost btn-small" data-size="${p.id}">${p.sizesAvailable.map((s) => `<option>${esc(s)}</option>`).join("")}</select>` : ""}
      </div>
      <button class="btn-ghost btn-small" style="margin-top:10px" data-act="addCart" data-id="${p.id}" data-name="${esc(p.name)}" data-price="${price}">Add to bag</button>
    </div>`;
  }
  function renderCart() {
    const lines = Object.values(cart);
    const card = $("#cartCard");
    if (!card) return;
    card.hidden = lines.length === 0;
    $("#cartLines").innerHTML = lines
      .map((l) => `<div class="row-between" style="padding:6px 0;border-bottom:1px solid var(--border)"><span>${esc(l.name)} ${l.size ? "(" + esc(l.size) + ")" : ""} × ${l.quantity}</span><span>${money(l.price * l.quantity)} <a data-act="rmCart" data-id="${l.productId}" style="cursor:pointer;color:#f27575">✕</a></span></div>`)
      .join("") + `<div class="row-between" style="padding-top:8px;font-weight:800"><span>Total</span><span>${money(lines.reduce((s, l) => s + l.price * l.quantity, 0))}</span></div>`;
  }
  function wireStore() {
    view().addEventListener("click", async (e) => {
      const t = e.target.closest("[data-act]");
      if (!t) return;
      if (t.dataset.act === "addCart") {
        const id = t.dataset.id;
        const size = view().querySelector(`[data-size="${id}"]`)?.value;
        cart[id] = cart[id] || { productId: id, name: t.dataset.name, price: Number(t.dataset.price), size, quantity: 0 };
        cart[id].quantity++;
        cart[id].size = size;
        renderCart();
        toast("Added to bag", "ok");
      } else if (t.dataset.act === "rmCart") {
        delete cart[t.dataset.id];
        renderCart();
      } else if (t.dataset.act === "checkout") {
        const shippingAddress = $("#shipAddr").value.trim();
        if (shippingAddress.length < 5) return toast("Add a shipping address", "error");
        const items = Object.values(cart).map((l) => ({ productId: l.productId, size: l.size, quantity: l.quantity }));
        if (!items.length) return toast("Your bag is empty", "error");
        busy(t, true, "Placing order…");
        try {
          const { order, keyId } = await api.post("/store/orders", { items, shippingAddress });
          for (const k of Object.keys(cart)) delete cart[k];
          renderCart();
          if (order.gatewayRef && keyId) {
            await payWithRazorpay(
              { orderId: order.gatewayRef, amount: Math.round(Number(order.totalAmount) * 100), keyId, description: "AKDFA Store order" },
              () => (location.hash = "#/orders")
            );
          } else {
            toast("Order placed — you'll be contacted for payment.", "ok");
            location.hash = "#/orders";
          }
        } catch (err) {
          toast(err.message, "error");
        } finally {
          busy(t, false);
        }
      }
    });
  }

  R("/orders", "My Orders", {
    render: async () => {
      const { orders } = await api.get("/store/orders/me");
      if (!orders.length) return `<div class="pv-head"><h1>My Orders</h1></div><div class="empty">No orders yet. <a href="#/store">Visit the store</a>.</div>`;
      return `<div class="pv-head"><h1>My Orders</h1></div><div class="list">${orders
        .map((o) => `<div class="card"><div class="row-between"><strong>${money(o.totalAmount)}</strong><span class="pill">${titleCase(o.status)}</span></div>
          <small class="card-muted">${fmtDate(o.createdAt)} · ${o.items.map((i) => `${esc(i.product.name)}${i.size ? " (" + esc(i.size) + ")" : ""} ×${i.quantity}`).join(", ")}</small>
          <div style="margin-top:6px"><small class="card-muted">Ship to: ${esc(o.shippingAddress || "—")}</small></div>
          ${["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(o.status) ? `<div style="margin-top:8px"><button class="btn-ghost btn-small" data-act="orderReceipt" data-id="${o.id}">Download receipt</button></div>` : ""}
        </div>`)
        .join("")}</div>`;
    },
    after: () => {
      view().addEventListener("click", async (e) => {
        const t = e.target.closest('[data-act="orderReceipt"]');
        if (!t) return;
        try { await api.openFile(`/store/orders/${t.dataset.id}/receipt`); }
        catch (err) { toast(err.message, "error"); }
      });
    },
  });

  /* ---------- Membership fee ---------- */
  R("/membership", "Membership Fee", {
    render: async () => {
      const { fees } = await api.get("/payments/membership-fees/me");
      const year = new Date().getFullYear();
      const thisYear = fees.find((f) => f.period === year);
      const paid = thisYear && thisYear.status === "SUCCESS";
      return `
        <div class="pv-head"><h1>Membership Fee</h1><p>Pay your yearly AKDFA membership fee online.</p></div>
        <div class="card" style="max-width:460px">
          <div class="row-between"><h2>${year} membership</h2>${paid ? '<span class="pill pill--ok">Paid</span>' : '<span class="pill pill--warn">Due</span>'}</div>
          ${paid
            ? `<p class="card-muted">Paid on ${fmtDate(thisYear.paidAt)}.</p><button class="btn-ghost btn-small" data-act="feeReceipt" data-id="${thisYear.id}">Download receipt</button>`
            : `<p class="card-muted">Complete your ${year} fee to keep your digital card active for the year.</p>
               <button class="btn btn-primary" data-act="payFee" data-period="${year}">Pay now</button>`}
        </div>
        <div class="card" style="margin-top:16px">
          <h2>Payment history</h2>
          ${fees.length ? `<div class="table-wrap"><table class="pv-table"><thead><tr><th>Year</th><th>Amount</th><th>Status</th><th>Paid</th><th></th></tr></thead>
            <tbody>${fees.map((f) => `<tr><td>${f.period}</td><td>${money(f.amount)}</td><td>${titleCase(f.status)}</td><td>${fmtDate(f.paidAt)}</td><td>${f.status === "SUCCESS" ? `<button class="btn-ghost btn-small" data-act="feeReceipt" data-id="${f.id}">Receipt</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`
            : '<p class="card-muted">No payments yet.</p>'}
        </div>`;
    },
    after: () => {
      view().addEventListener("click", async (e) => {
        const rec = e.target.closest('[data-act="feeReceipt"]');
        if (rec) {
          try { await api.openFile(`/payments/membership-fees/${rec.dataset.id}/receipt`); }
          catch (err) { toast(err.message, "error"); }
          return;
        }
        const t = e.target.closest('[data-act="payFee"]');
        if (!t) return;
        busy(t, true, "Starting…");
        try {
          const order = await api.post(`/payments/membership-fees/${t.dataset.period}/checkout`, {});
          await payWithRazorpay({ ...order, description: `AKDFA membership ${t.dataset.period}` }, () => render());
        } catch (err) {
          toast(err.status === 503 ? "Payments aren't switched on yet." : err.message, "error");
        } finally {
          busy(t, false);
        }
      });
    },
  });

  /* ---------- Notifications ---------- */
  R("/notifications", "Notifications", {
    render: async () => {
      const [{ notifications }, { preferences }] = await Promise.all([
        api.get("/notifications/me"),
        api.get("/notifications/me/preferences"),
      ]);
      const cats = ["EVENT", "NEWS", "PAYMENT", "ANNOUNCEMENT", "CRICKET"];
      const chans = ["PUSH", "EMAIL", "SMS"];
      const prefOf = (c, ch) => {
        const p = preferences.find((x) => x.category === c && x.channel === ch);
        return p ? p.enabled : true;
      };
      return `
        <div class="pv-head"><h1>Notifications</h1></div>
        <div class="grid grid-2">
          <div class="card"><div class="row-between"><h2>Recent</h2>${notifications.some((n) => !n.readAt) ? '<button class="btn-ghost btn-small" data-act="readAll">Mark all read</button>' : ""}</div>
            <div class="list" style="margin-top:10px">
              ${notifications.length ? notifications.map((n) => `<div class="list-item notif ${n.readAt ? "" : "is-unread"}" data-act="readOne" data-id="${n.id}">
                <div class="li-main"><strong>${esc(n.title)}</strong><small>${esc(n.body)}</small><br><small class="card-muted">${fmtDateTime(n.sentAt)} · ${titleCase(n.category)}</small></div></div>`).join("")
                : '<p class="card-muted">Nothing yet.</p>'}
            </div>
          </div>
          <div class="card"><h2>What to notify me about</h2>
            <div class="table-wrap" style="margin-top:10px"><table class="pv-table"><thead><tr><th>Topic</th>${chans.map((c) => `<th>${titleCase(c)}</th>`).join("")}</tr></thead>
              <tbody>${cats.map((c) => `<tr><td>${titleCase(c)}</td>${chans.map((ch) => `<td><input type="checkbox" data-act="pref" data-cat="${c}" data-chan="${ch}" ${prefOf(c, ch) ? "checked" : ""}></td>`).join("")}</tr>`).join("")}</tbody>
            </table></div>
          </div>
        </div>`;
    },
    after: () => {
      view().addEventListener("click", async (e) => {
        const one = e.target.closest('[data-act="readOne"]');
        const all = e.target.closest('[data-act="readAll"]');
        if (one && one.classList.contains("is-unread")) {
          await api.patch(`/notifications/${one.dataset.id}/read`, {});
          one.classList.remove("is-unread");
          refreshBell();
        }
        if (all) {
          const unread = view().querySelectorAll(".notif.is-unread");
          for (const n of unread) {
            await api.patch(`/notifications/${n.dataset.id}/read`, {});
            n.classList.remove("is-unread");
          }
          refreshBell();
        }
      });
      view().addEventListener("change", async (e) => {
        const p = e.target.closest('[data-act="pref"]');
        if (!p) return;
        try {
          await api.put("/notifications/me/preferences", { category: p.dataset.cat, channel: p.dataset.chan, enabled: p.checked });
          toast("Saved", "ok");
        } catch (err) {
          toast(err.message, "error");
          p.checked = !p.checked;
        }
      });
    },
  });

  /* ---------- Profile ---------- */
  R("/profile", "Profile & Badges", {
    render: async () => {
      const [{ badges }, { referrals }, allBadges] = await Promise.all([
        api.get("/growth/me/badges"),
        api.get("/growth/me/referrals"),
        api.get("/growth/badges").then((r) => r.badges).catch(() => []),
      ]);
      const refLink = `${location.origin}${location.pathname.replace("app.html", "join.html")}?ref=${me.id}`;
      const earnedIds = new Set(badges.map((b) => b.badgeId));
      return `
        <div class="pv-head"><h1>Profile</h1></div>
        <div class="grid grid-2">
          <div class="card"><h2>Your details</h2>
            <div class="pv-form" id="profForm" style="margin-top:10px">
              <label>Full name<input name="fullName" value="${esc(me.fullName)}"></label>
              <label>Phone<input name="phone" value="${esc(me.phone)}"></label>
              <label>Profile photo<input type="file" id="profPhoto" accept="image/*"></label>
              <button class="btn btn-primary" data-act="saveProfile">Save</button>
              <span class="pv-msg" id="profMsg"></span>
            </div>
          </div>
          <div class="card"><h2>Refer a friend</h2>
            <p class="card-muted">Share this link. When they join and are approved, it counts as your referral.</p>
            <input class="btn-ghost" style="width:100%" readonly value="${esc(refLink)}" onclick="this.select()">
            <h3 style="margin-top:16px">Your referrals (${referrals.length})</h3>
            <div class="list">${referrals.length ? referrals.map((r) => `<div class="list-item"><div class="li-main"><strong>${esc(r.referred.fullName)}</strong><small>${esc(r.referred.memberNumber || "pending")}</small></div><span class="pill">${titleCase(r.status)}</span></div>`).join("") : '<p class="card-muted">None yet.</p>'}</div>
          </div>
        </div>
        <div class="card" style="margin-top:16px;max-width:420px"><h2>Change password</h2>
          <div class="pv-form" id="pwForm" style="margin-top:10px">
            <label>Current password<input type="password" name="currentPassword" autocomplete="current-password"></label>
            <label>New password<input type="password" name="newPassword" autocomplete="new-password" minlength="8"></label>
            <button class="btn btn-primary" data-act="changePw">Update password</button><span class="pv-msg" id="pwMsg"></span>
          </div>
        </div>
        <div class="card" style="margin-top:16px"><h2>Badges</h2>
          <div class="grid grid-3" style="margin-top:10px">
            ${(allBadges.length ? allBadges : badges.map((b) => b.badge)).map((b) => {
              const earned = earnedIds.has(b.id) || badges.some((x) => x.badge?.name === b.name);
              return `<div class="badge-chip" style="opacity:${earned ? 1 : 0.4}"><i class="fa-solid fa-medal"></i><div><strong>${esc(b.name)}</strong><br><small class="card-muted">${esc(b.description || b.criteria || "")}</small></div></div>`;
            }).join("")}
          </div>
        </div>`;
    },
    after: () => {
      view().addEventListener("click", async (e) => {
        const pw = e.target.closest('[data-act="changePw"]');
        if (pw) {
          const d = readForm($("#pwForm"));
          if (!d.currentPassword || !d.newPassword || d.newPassword.length < 8) {
            return setMsg("pwMsg", "Enter your current password and a new one (8+ chars).", false);
          }
          busy(pw, true, "Updating…");
          try {
            const r = await api.post("/auth/change-password", d);
            api.session.set(r); // rotated tokens
            setMsg("pwMsg", "Password updated. Other devices have been signed out.", true);
            $("#pwForm").querySelectorAll("input").forEach((i) => (i.value = ""));
          } catch (err) { setMsg("pwMsg", err.message, false); }
          finally { busy(pw, false); }
          return;
        }
        const t = e.target.closest('[data-act="saveProfile"]');
        if (!t) return;
        const msg = $("#profMsg");
        const data = readForm($("#profForm"));
        busy(t, true, "Saving…");
        try {
          const file = $("#profPhoto").files[0];
          if (file) data.profilePhotoUrl = await api.upload(file);
          const { member } = await api.patch(`/members/${me.id}`, data);
          me = Object.assign(me, member);
          api.session.set({ member: me });
          renderWhoami();
          msg.textContent = "Saved.";
          msg.className = "pv-msg pv-msg--ok";
        } catch (err) {
          msg.textContent = err.message;
          msg.className = "pv-msg pv-msg--error";
        } finally {
          busy(t, false);
        }
      });
    },
  });

  /* ================================================================
   * COMMITTEE (admin) ROUTES
   * ============================================================== */

  /* ---------- Members ---------- */
  R("/admin/members", "Members", {
    role: "UNIT_ADMIN",
    render: async () => {
      const params = new URLSearchParams();
      const status = currentQuery().status || "PENDING";
      if (status !== "ALL") params.set("status", status);
      const { members } = await api.get("/members?" + params.toString());
      const canRole = can("DISTRICT_ADMIN");
      return `
        <div class="pv-head"><h1>Members</h1><p>${can("STATE_ADMIN") ? "Every member across the state." : can("DISTRICT_ADMIN") ? "Members in your district." : "Members in your unit."}</p></div>
        <div class="pv-tabs">
          ${["PENDING", "ACTIVE", "LAPSED", "ALL"].map((s) => `<button class="${s === status ? "is-active" : ""}" data-act="mstatus" data-s="${s}">${titleCase(s)}</button>`).join("")}
        </div>
        ${members.length ? `<div class="table-wrap"><table class="pv-table"><thead><tr><th>Name</th><th>No.</th><th>Unit</th><th>Status</th><th>Role</th><th></th></tr></thead>
          <tbody>${members.map((m) => `<tr>
            <td>${esc(m.fullName)}<br><small class="card-muted">${esc(m.email)}</small></td>
            <td>${esc(m.memberNumber)}</td>
            <td>${esc(m.unit?.name || m.unitId)}</td>
            <td><span class="pill ${m.status === "ACTIVE" ? "pill--ok" : m.status === "PENDING" ? "pill--warn" : "pill--bad"}">${titleCase(m.status)}</span></td>
            <td>${canRole ? `<select class="btn-ghost btn-small" data-act="setRole" data-id="${m.id}">${["MEMBER", "UNIT_ADMIN", "DISTRICT_ADMIN", "STATE_ADMIN"].map((r) => `<option ${r === m.role ? "selected" : ""}>${r}</option>`).join("")}</select>` : titleCase(m.role)}</td>
            <td>${m.status === "PENDING" ? `<button class="btn-ghost btn-small" data-act="approveM" data-id="${m.id}">Approve</button> <button class="btn-ghost btn-small btn-danger" data-act="rejectM" data-id="${m.id}">Reject</button>` : ""}</td>
          </tr>`).join("")}</tbody></table></div>`
          : '<div class="empty">No members in this view.</div>'}`;
    },
    after: () => {
      view().addEventListener("click", async (e) => {
        const st = e.target.closest('[data-act="mstatus"]');
        if (st) {
          location.hash = "#/admin/members?status=" + st.dataset.s;
          return;
        }
        const ap = e.target.closest('[data-act="approveM"]');
        if (ap) {
          busy(ap, true, "…");
          try {
            await api.post(`/members/${ap.dataset.id}/approve`, {});
            toast("Member approved", "ok");
            render();
          } catch (err) {
            toast(err.message, "error");
            busy(ap, false);
          }
        }
        const rj = e.target.closest('[data-act="rejectM"]');
        if (rj) {
          if (!confirm("Reject this membership application?")) return;
          busy(rj, true, "…");
          try {
            await api.post(`/members/${rj.dataset.id}/reject`, {});
            toast("Application rejected", "ok");
            render();
          } catch (err) { toast(err.message, "error"); busy(rj, false); }
        }
      });
      view().addEventListener("change", async (e) => {
        const r = e.target.closest('[data-act="setRole"]');
        if (!r) return;
        try {
          await api.patch(`/members/${r.dataset.id}/role`, { role: r.value });
          toast("Role updated", "ok");
        } catch (err) {
          toast(err.message, "error");
          render();
        }
      });
    },
  });

  /* ---------- Units ---------- */
  R("/admin/units", "Units", {
    role: "DISTRICT_ADMIN",
    render: async () => {
      const ds = await districts();
      const { units } = await api.get("/units?status=ALL");
      const pending = units.filter((u) => u.status === "PENDING");
      return `
        <div class="pv-head"><h1>Units</h1><p>Approve local clubs and register new ones.</p></div>
        <div class="grid grid-2">
          <div class="card"><h2>Pending approval (${pending.length})</h2>
            <div class="list" style="margin-top:10px">${pending.length ? pending.map((u) => `<div class="list-item"><div class="li-main"><strong>${esc(u.name)}</strong><small>${esc(u.address || "")}</small></div><div class="row"><button class="btn-ghost btn-small" data-act="approveU" data-id="${u.id}">Approve</button><button class="btn-ghost btn-small btn-danger" data-act="rejectU" data-id="${u.id}">Reject</button></div></div>`).join("") : '<p class="card-muted">Nothing pending.</p>'}</div>
          </div>
          <div class="card"><h2>Register a unit</h2>
            <div class="pv-form" id="unitForm" style="margin-top:10px">
              <label>District<select name="districtId">${ds.map((d) => `<option value="${d.id}" ${d.id === me.districtId ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></label>
              <label>Name<input name="name" placeholder="e.g. Fort Kochi Club"></label>
              <label>Address<input name="address"></label>
              <div class="form-row"><label>Contact email<input name="contactEmail" type="email"></label><label>Contact phone<input name="contactPhone"></label></div>
              <button class="btn btn-primary" data-act="createUnit">Create (pending)</button><span class="pv-msg" id="unitMsg"></span>
            </div>
          </div>
        </div>
        <div class="card" style="margin-top:16px"><h2>All units (${units.length})</h2>
          <div class="table-wrap"><table class="pv-table"><thead><tr><th>Name</th><th>District</th><th>Status</th><th>Contact</th></tr></thead>
          <tbody>${units.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc((ds.find((d) => d.id === u.districtId) || {}).name || "")}</td><td>${titleCase(u.status)}</td><td>${esc(u.contactPhone || u.contactEmail || "—")}</td></tr>`).join("")}</tbody></table></div>
        </div>`;
    },
    after: () => {
      view().addEventListener("click", async (e) => {
        const a = e.target.closest('[data-act="approveU"]');
        if (a) {
          busy(a, true, "…");
          try { await api.post(`/units/${a.dataset.id}/approve`, {}); toast("Unit approved", "ok"); render(); }
          catch (err) { toast(err.message, "error"); busy(a, false); }
        }
        const ru = e.target.closest('[data-act="rejectU"]');
        if (ru) {
          if (!confirm("Reject this unit?")) return;
          busy(ru, true, "…");
          try { await api.post(`/units/${ru.dataset.id}/reject`, {}); toast("Unit rejected", "ok"); render(); }
          catch (err) { toast(err.message, "error"); busy(ru, false); }
        }
        const c = e.target.closest('[data-act="createUnit"]');
        if (c) {
          const msg = $("#unitMsg");
          busy(c, true, "…");
          try {
            await api.post("/units", readForm($("#unitForm")));
            msg.textContent = "Created — pending approval.";
            msg.className = "pv-msg pv-msg--ok";
            render();
          } catch (err) { msg.textContent = err.message; msg.className = "pv-msg pv-msg--error"; busy(c, false); }
        }
      });
    },
  });

  /* ---------- Content: news / events / polls ---------- */
  R("/admin/content", "Content", {
    role: "UNIT_ADMIN",
    render: async () => {
      const ds = await districts();
      const dOpts = ds.map((d) => `<option value="${d.id}" ${d.id === me.districtId ? "selected" : ""}>${esc(d.name)}</option>`).join("");
      const scopeOpts = can("STATE_ADMIN") ? ["DISTRICT", "STATE", "UNIT"] : ["DISTRICT", "UNIT"];
      return `
        <div class="pv-head"><h1>News / Events / Polls</h1><p>Publish to your ${can("STATE_ADMIN") ? "state or district" : "district"} feed.</p></div>
        <div class="pv-tabs"><button class="is-active" data-tab="news">News</button><button data-tab="event">Event</button><button data-tab="poll">Poll</button></div>

        <div data-panel="news"><div class="card"><h2>New post</h2>
          <div class="pv-form" id="newsForm" style="margin-top:10px">
            <label>Title<input name="title"></label>
            <label>Body<textarea name="body"></textarea></label>
            <label>Cover image<input type="file" id="newsImg" accept="image/*"></label>
            <div class="form-row">
              <label>Scope<select name="scope">${scopeOpts.map((s) => `<option>${s}</option>`).join("")}</select></label>
              <label>District<select name="districtId">${dOpts}</select></label>
            </div>
            <label class="row" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="publishNow" checked style="width:auto"> Publish immediately</label>
            <button class="btn btn-primary" data-act="createNews">Publish</button><span class="pv-msg" id="newsMsg"></span>
          </div></div>
          <div class="card" style="margin-top:14px"><h2>Recent posts</h2><div id="newsList" class="list"></div></div>
        </div>

        <div data-panel="event" hidden><div class="card"><h2>New event</h2>
          <div class="pv-form" id="evtForm" style="margin-top:10px">
            <label>Title<input name="title"></label>
            <div class="form-row">
              <label>Type<select name="type">${["TOURNAMENT", "CHARITY", "MATCH", "MEETING", "TRIAL", "OTHER"].map((t) => `<option>${t}</option>`).join("")}</select></label>
              <label>Scope<select name="scope">${scopeOpts.map((s) => `<option>${s}</option>`).join("")}</select></label>
            </div>
            <label>District<select name="districtId">${dOpts}</select></label>
            <div class="form-row"><label>Starts<input type="datetime-local" name="startsAt"></label><label>Ends<input type="datetime-local" name="endsAt"></label></div>
            <label>Location<input name="location"></label>
            <label>Description<textarea name="description"></textarea></label>
            <button class="btn btn-primary" data-act="createEvent">Create</button><span class="pv-msg" id="evtMsg"></span>
          </div></div>

          <div class="card" style="margin-top:14px"><h2>Photos, brackets &amp; charity reports</h2>
            <div class="pv-form" style="margin-top:10px">
              <label>Event<select id="evtPick"><option value="">Select an event…</option></select></label>
            </div>
            <div id="evtExtras" hidden style="margin-top:12px">
              <div class="pv-form" id="evtEdit">
                <label>Title<input name="title"></label>
                <div class="form-row"><label>Starts<input type="datetime-local" name="startsAt"></label><label>Location<input name="location"></label></div>
                <div class="row"><button class="btn btn-primary btn-small" data-act="saveEvent">Save details</button>
                <button class="btn-ghost btn-small btn-danger" data-act="deleteEvent">Delete event</button></div>
              </div>
              <div class="pv-form" style="margin-top:12px">
                <label>Add photos<input type="file" id="evtPhotos" accept="image/*" multiple></label>
                <button class="btn-ghost btn-small" data-act="uploadEvtPhotos">Upload photos</button>
                <div id="evtPhotoStrip" class="row" style="margin-top:6px"></div>
              </div>
              <div class="pv-form" id="brk" style="margin-top:12px">
                <label>Tournament bracket (one line per match: <code>Team A vs Team B — winner</code>)<textarea name="bracketText" rows="4"></textarea></label>
                <button class="btn-ghost btn-small" data-act="saveBracket">Save bracket</button>
              </div>
              <div class="pv-form" id="charityForm" style="margin-top:12px">
                <h3>Charity report</h3>
                <div class="form-row"><label>People helped<input type="number" name="peopleHelped"></label>
                <label>Raised (₹)<input type="number" name="amountRaised"></label>
                <label>Spent (₹)<input type="number" name="amountSpent"></label></div>
                <label>Beneficiary<input name="beneficiary"></label>
                <label>Summary<textarea name="summary"></textarea></label>
                <button class="btn btn-primary btn-small" data-act="saveCharity">Save charity report</button><span class="pv-msg" id="charMsg"></span>
              </div>
            </div>
          </div>
        </div>

        <div data-panel="poll" hidden><div class="card"><h2>New poll</h2>
          <div class="pv-form" id="pollForm" style="margin-top:10px">
            <label>Question<input name="question"></label>
            <label>Options (one per line)<textarea name="options" placeholder="Yes&#10;No&#10;Maybe"></textarea></label>
            <div class="form-row">
              <label>Scope<select name="scope">${scopeOpts.map((s) => `<option>${s}</option>`).join("")}</select></label>
              <label>Closes<input type="datetime-local" name="closesAt"></label>
            </div>
            <button class="btn btn-primary" data-act="createPoll">Create poll</button><span class="pv-msg" id="pollMsg"></span>
          </div></div>
          <div class="card" style="margin-top:14px"><h2>Existing polls</h2><div id="pollList" class="list" style="margin-top:10px"></div></div>
        </div>`;
    },
    after: async () => {
      tabWiring();
      const refreshNews = async () => {
        const { posts } = await api.get("/news?districtId=" + encodeURIComponent(me.districtId || ""));
        $("#newsList").innerHTML = posts.slice(0, 10).map((p) => `<div class="list-item"><div class="li-main"><strong>${esc(p.title)}</strong><small>${titleCase(p.scope)} · ${fmtDate(p.publishedAt || p.createdAt)}</small></div><button class="btn-ghost btn-small btn-danger" data-act="delNews" data-id="${p.id}">Delete</button></div>`).join("") || '<p class="card-muted">None.</p>';
      };
      refreshNews();

      // ---- event photos / brackets / charity reports ----
      let currentEvent = null;
      const drawPhotos = () => {
        $("#evtPhotoStrip").innerHTML = (currentEvent?.photos || [])
          .map((u) => `<a href="${esc(u)}" target="_blank"><img src="${esc(u)}" style="height:52px;border-radius:6px;object-fit:cover"></a>`)
          .join("");
      };
      const refreshPolls = async () => {
        const box = $("#pollList");
        if (!box) return;
        const { polls } = await api.get("/polls");
        box.innerHTML = polls.length
          ? polls.map((p) => {
              const closed = p.closesAt && new Date(p.closesAt) < Date.now();
              return `<div class="list-item"><div class="li-main"><strong>${esc(p.question)}</strong><small>${p.totalVotes || 0} votes${closed ? " · closed" : p.closesAt ? " · closes " + fmtDate(p.closesAt) : ""}</small></div>
                <div class="row">${closed ? "" : `<button class="btn-ghost btn-small" data-act="closePoll" data-id="${p.id}">Close</button>`}
                <button class="btn-ghost btn-small btn-danger" data-act="delPoll" data-id="${p.id}">Delete</button></div></div>`;
            }).join("")
          : '<p class="card-muted">No polls.</p>';
      };
      refreshPolls();

      const selectEvent = async (id) => {
        if (!id) { $("#evtExtras").hidden = true; return; }
        const { event } = await api.get("/events/" + id);
        currentEvent = event;
        $("#evtExtras").hidden = false;
        $('#evtEdit [name="title"]').value = event.title || "";
        $('#evtEdit [name="location"]').value = event.location || "";
        $('#evtEdit [name="startsAt"]').value = event.startsAt ? new Date(event.startsAt).toISOString().slice(0, 16) : "";
        $("#brk").hidden = event.type !== "TOURNAMENT";
        $("#charityForm").hidden = event.type !== "CHARITY";
        $('#brk textarea[name="bracketText"]').value = Array.isArray(event.bracket) ? event.bracket.join("\n") : "";
        const cr = event.charityReport || {};
        ["peopleHelped", "amountRaised", "amountSpent", "beneficiary", "summary"].forEach((k) => {
          const el = view().querySelector(`#charityForm [name="${k}"]`);
          if (el) el.value = cr[k] ?? "";
        });
        drawPhotos();
      };
      try {
        const { events } = await api.get("/events?from=" + new Date(Date.now() - 180 * 86400000).toISOString());
        $("#evtPick").innerHTML =
          '<option value="">Select an event…</option>' +
          events.map((e) => `<option value="${e.id}">${esc(e.title)} — ${fmtDate(e.startsAt)}</option>`).join("");
        $("#evtPick").onchange = (ev) => selectEvent(ev.target.value).catch((err) => toast(err.message, "error"));
      } catch (_) {}

      view().addEventListener("click", async (e) => {
        const t = e.target.closest("[data-act]");
        if (!t) return;
        const act = t.dataset.act;
        try {
          if (act === "uploadEvtPhotos") {
            const files = [...$("#evtPhotos").files];
            if (!files.length || !currentEvent) return;
            busy(t, true, "Uploading…");
            const urls = [];
            for (const f of files) urls.push(await api.upload(f));
            const merged = [...(currentEvent.photos || []), ...urls];
            await api.patch(`/events/${currentEvent.id}/photos`, { photos: merged });
            currentEvent.photos = merged;
            drawPhotos();
            toast("Photos added", "ok");
          } else if (act === "saveEvent") {
            busy(t, true, "…");
            await api.patch(`/events/${currentEvent.id}`, readForm($("#evtEdit")));
            toast("Event updated", "ok");
          } else if (act === "deleteEvent") {
            if (!confirm("Delete this event?")) return;
            await api.del(`/events/${currentEvent.id}`);
            toast("Event deleted", "ok");
            render();
          } else if (act === "closePoll") {
            await api.post(`/polls/${t.dataset.id}/close`, {});
            refreshPolls();
          } else if (act === "delPoll") {
            if (!confirm("Delete this poll and its votes?")) return;
            await api.del(`/polls/${t.dataset.id}`);
            refreshPolls();
          } else if (act === "saveBracket") {
            const lines = $('#brk textarea[name="bracketText"]').value.split("\n").map((s) => s.trim()).filter(Boolean);
            await api.patch(`/events/${currentEvent.id}`, { bracket: lines });
            toast("Bracket saved", "ok");
          } else if (act === "saveCharity") {
            const d = readForm($("#charityForm"));
            delete d.bracketText;
            busy(t, true, "…");
            await api.put(`/events/${currentEvent.id}/charity-report`, d);
            setMsg("charMsg", "Charity report saved.", true);
          } else if (act === "createNews") {
            const d = readForm($("#newsForm"));
            const f = $("#newsImg").files[0];
            if (f) d.coverImageUrl = await api.upload(f);
            if (d.scope === "STATE") delete d.districtId;
            busy(t, true, "…");
            await api.post("/news", d);
            setMsg("newsMsg", "Published.", true);
            refreshNews();
          } else if (act === "delNews") {
            await api.del(`/news/${t.dataset.id}`);
            refreshNews();
          } else if (act === "createEvent") {
            const d = readForm($("#evtForm"));
            if (d.scope === "STATE") delete d.districtId;
            busy(t, true, "…");
            await api.post("/events", d);
            setMsg("evtMsg", "Event created.", true);
          } else if (act === "createPoll") {
            const d = readForm($("#pollForm"));
            d.options = (d.options || "").split("\n").map((s) => s.trim()).filter(Boolean);
            busy(t, true, "…");
            await api.post("/polls", d);
            setMsg("pollMsg", "Poll created.", true);
          }
        } catch (err) {
          const map = { createNews: "newsMsg", createEvent: "evtMsg", createPoll: "pollMsg" };
          if (map[act]) setMsg(map[act], err.message, false);
          else toast(err.message, "error");
        } finally {
          busy(t, false);
        }
      });
    },
  });

  /* ---------- Manage cricket ---------- */
  R("/admin/cricket", "Manage Cricket", {
    role: "UNIT_ADMIN",
    render: async () => {
      const [{ teams }, { units }, { members }] = await Promise.all([
        api.get("/cricket/teams"),
        api.get("/units?status=ALL"),
        api.get("/members?status=ACTIVE").catch(() => ({ members: [] })),
      ]);
      const memberOpts = members.map((m) => `<option value="${m.id}">${esc(m.fullName)} (${esc(m.memberNumber)})</option>`).join("");
      return `
        <div class="pv-head"><h1>Manage Cricket</h1></div>
        <div class="grid grid-2">
          <div class="card"><h2>Register team</h2>
            <div class="pv-form" id="teamForm" style="margin-top:10px">
              <label>Unit<select name="unitId">${units.map((u) => `<option value="${u.id}" ${u.id === me.unitId ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></label>
              <label>Team name<input name="name"></label>
              <div class="form-row"><label>Season<input name="season" value="${new Date().getFullYear()}"></label>
              <label>Captain<select name="captainId"><option value="">—</option>${memberOpts}</select></label></div>
              <button class="btn btn-primary" data-act="createTeam">Create</button><span class="pv-msg" id="teamMsg"></span>
            </div>
          </div>
          <div class="card"><h2>Schedule match</h2>
            <div class="pv-form" id="matchForm" style="margin-top:10px">
              <div class="form-row"><label>Home<select name="homeTeamId">${teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></label>
              <label>Away<select name="awayTeamId">${teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></label></div>
              <div class="form-row"><label>When<input type="datetime-local" name="scheduledAt"></label><label>Venue<input name="venue"></label></div>
              <button class="btn btn-primary" data-act="createMatch">Schedule</button><span class="pv-msg" id="matchMsg"></span>
            </div>
          </div>
        </div>
        <div class="card" style="margin-top:16px"><h2>Teams &amp; rosters</h2>
          <div class="stack" style="margin-top:10px">${teams.map((t) => `
            <div class="list-item" style="flex-wrap:wrap"><div class="li-main"><strong>${esc(t.name)}</strong><small>${t._count?.players || 0} players · ${esc(t.season)}</small></div>
            <div class="row"><select class="btn-ghost btn-small" data-roster="${t.id}"><option value="">Add player…</option>${memberOpts}</select>
            <button class="btn-ghost btn-small" data-act="addPlayer" data-id="${t.id}">Add</button>
            <button class="btn-ghost btn-small" data-act="viewRoster" data-id="${t.id}" data-name="${esc(t.name)}">Roster</button></div></div>`).join("") || '<p class="card-muted">No teams.</p>'}</div>
        </div>
        <div class="card" style="margin-top:16px"><h2>Post a result</h2>
          <div class="pv-form" id="resultForm" style="margin-top:10px">
            <label>Match<select name="matchId" id="resMatch"><option value="">Loading…</option></select></label>
            <div class="form-row"><label>Home score<input name="homeScore"></label><label>Away score<input name="awayScore"></label></div>
            <label>Result summary<input name="resultSummary" placeholder="e.g. Kochi Unit won by 5 wickets"></label>
            <label>Match photos<input type="file" id="resPhotos" accept="image/*" multiple></label>
            <input type="hidden" name="status" value="COMPLETED">
            <button class="btn btn-primary" data-act="postResult">Save result</button><span class="pv-msg" id="resMsg"></span>
          </div>
        </div>
        <div class="card" style="margin-top:16px"><h2>Create trial</h2>
          <div class="pv-form" id="trialForm" style="margin-top:10px">
            <label>Team<select name="teamId">${teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></label>
            <div class="form-row"><label>When<input type="datetime-local" name="scheduledAt"></label><label>Location<input name="location"></label></div>
            <label>Notes<input name="description"></label>
            <button class="btn btn-primary" data-act="createTrial">Create trial</button><span class="pv-msg" id="trialMsg"></span>
          </div>
        </div>
        <div class="card" style="margin-top:16px"><h2>Trials &amp; applicants</h2>
          <div id="trialList" class="stack" style="margin-top:10px"><p class="card-muted">Loading…</p></div>
        </div>`;
    },
    after: async () => {
      try {
        const { matches } = await api.get("/cricket/matches?status=SCHEDULED");
        const sel = $("#resMatch");
        if (sel) sel.innerHTML = matches.length
          ? matches.map((m) => `<option value="${m.id}">${esc(m.homeTeam?.name)} vs ${esc(m.awayTeam?.name)} · ${fmtDate(m.scheduledAt)}</option>`).join("")
          : '<option value="">No scheduled matches</option>';
      } catch (_) {}

      const refreshTrials = async () => {
        const box = $("#trialList");
        if (!box) return;
        const { trials } = await api.get("/cricket/trials");
        const upcoming = trials.filter((t) => new Date(t.scheduledAt) >= Date.now() - 30 * 86400000);
        if (!upcoming.length) { box.innerHTML = '<p class="card-muted">No trials.</p>'; return; }
        const withApps = await Promise.all(
          upcoming.map((t) => api.get(`/cricket/trials/${t.id}/applications`).then((r) => ({ ...t, apps: r.applications })).catch(() => ({ ...t, apps: [] })))
        );
        box.innerHTML = withApps
          .map((t) => `<div class="card"><strong>Trial · ${fmtDate(t.scheduledAt)}</strong> <small class="card-muted">${esc(t.location || "")}</small>
            <div class="list" style="margin-top:8px">${t.apps.length ? t.apps.map((a) => `<div class="list-item"><div class="li-main"><strong>${esc(a.member?.fullName)}</strong><small>${esc(a.member?.memberNumber)} · ${esc(a.member?.phone || "")}</small></div>
              <select class="btn-ghost btn-small" data-act="trialAppStatus" data-id="${a.id}">${["APPLIED", "SHORTLISTED", "SELECTED", "REJECTED"].map((s) => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>`).join("") : '<p class="card-muted">No applicants yet.</p>'}</div></div>`)
          .join("");
      };
      refreshTrials();
      view().addEventListener("change", async (e) => {
        const s = e.target.closest('[data-act="trialAppStatus"]');
        if (!s || s.value === "APPLIED") return;
        try { await api.patch(`/cricket/trials/applications/${s.dataset.id}`, { status: s.value }); toast("Updated", "ok"); }
        catch (err) { toast(err.message, "error"); }
      });
      view().addEventListener("click", async (e) => {
        const t = e.target.closest("[data-act]");
        if (!t) return;
        const a = t.dataset.act;
        try {
          busy(t, true, "…");
          if (a === "createTeam") { await api.post("/cricket/teams", readForm($("#teamForm"))); setMsg("teamMsg", "Team created.", true); render(); }
          else if (a === "createMatch") { await api.post("/cricket/matches", readForm($("#matchForm"))); setMsg("matchMsg", "Match scheduled.", true); }
          else if (a === "addPlayer") {
            const memberId = view().querySelector(`[data-roster="${t.dataset.id}"]`).value;
            if (!memberId) { busy(t, false); return; }
            await api.post(`/cricket/teams/${t.dataset.id}/players`, { memberId });
            toast("Player added", "ok"); render();
          } else if (a === "viewRoster") {
            busy(t, false);
            const { team } = await api.get(`/cricket/teams/${t.dataset.id}`);
            openModal(t.dataset.name + " roster", `<div class="list">${(team.players || []).length ? team.players.map((p) => `<div class="list-item"><div class="li-main"><strong>${esc(p.member?.fullName || "Player")}</strong><small>${esc(p.position || "")}${p.jerseyNumber ? " · #" + p.jerseyNumber : ""}</small></div><button class="btn-ghost btn-small btn-danger" data-act="removePlayer" data-id="${p.id}">Remove</button></div>`).join("") : '<p class="card-muted">No players.</p>'}</div>`, (modal) => {
              modal.addEventListener("click", async (ev) => {
                const rm = ev.target.closest('[data-act="removePlayer"]');
                if (!rm) return;
                try { await api.del(`/cricket/players/${rm.dataset.id}`); rm.closest(".list-item").remove(); toast("Removed", "ok"); }
                catch (err) { toast(err.message, "error"); }
              });
            });
          } else if (a === "postResult") {
            const d = readForm($("#resultForm"));
            const id = d.matchId; delete d.matchId;
            const files = [...($("#resPhotos").files || [])];
            if (files.length) {
              const urls = [];
              for (const f of files) urls.push(await api.upload(f));
              d.photos = urls;
            }
            await api.patch(`/cricket/matches/${id}/result`, d);
            setMsg("resMsg", "Result saved.", true);
          } else if (a === "createTrial") { await api.post("/cricket/trials", readForm($("#trialForm"))); setMsg("trialMsg", "Trial created.", true); }
        } catch (err) {
          const m = { createTeam: "teamMsg", createMatch: "matchMsg", postResult: "resMsg", createTrial: "trialMsg" }[a];
          if (m) setMsg(m, err.message, false); else toast(err.message, "error");
        } finally { busy(t, false); }
      });
    },
  });

  /* ---------- Sponsors & logs ---------- */
  R("/admin/sponsors", "Sponsors", {
    role: "DISTRICT_ADMIN",
    render: async () => {
      const ds = await districts();
      const [{ sponsors }, logsRes] = await Promise.all([
        api.get("/sponsors?scope=all"),
        api.get(`/sponsors/districts/${me.districtId}/logs`).catch(() => ({ logs: [] })),
      ]);
      const logs = logsRes.logs || [];
      return `
        <div class="pv-head"><h1>Sponsors &amp; Local Logs</h1></div>
        <div class="grid grid-2">
          <div class="card"><h2>Add sponsor</h2>
            <div class="pv-form" id="spForm" style="margin-top:10px">
              <label>Name<input name="name"></label>
              <label>Logo<input type="file" id="spLogo" accept="image/*"></label>
              <div class="form-row"><label>Tier<select name="tier">${["PLATINUM", "GOLD", "SILVER", "BRONZE", "COMMUNITY"].map((x) => `<option>${x}</option>`).join("")}</select></label>
              <label>District<select name="districtId"><option value="">State-level</option>${ds.map((d) => `<option value="${d.id}" ${d.id === me.districtId ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></label></div>
              <div class="form-row"><label>Contact email<input name="contactEmail" type="email"></label><label>Website<input name="website"></label></div>
              <button class="btn btn-primary" data-act="addSponsor">Add</button><span class="pv-msg" id="spMsg"></span>
            </div>
          </div>
          <div class="card"><h2>Log local sponsorship / expense</h2>
            <div class="pv-form" id="logForm" style="margin-top:10px">
              <label>Sponsor / payee<input name="sponsorName"></label>
              <div class="form-row"><label>Amount (₹)<input type="number" name="amount"></label>
              <label>Type<select name="type"><option>INCOME</option><option>EXPENSE</option></select></label></div>
              <label>Notes<input name="notes"></label>
              <button class="btn btn-primary" data-act="addLog">Record</button><span class="pv-msg" id="logMsg"></span>
            </div>
          </div>
        </div>
        <div class="card" style="margin-top:16px"><h2>Sponsors (${sponsors.length})</h2>
          <div class="stack" style="margin-top:10px">${sponsors.map((s) => `
            <div class="list-item" style="flex-wrap:wrap">
              <div class="li-main"><strong>${esc(s.name)}</strong> <span class="pill">${titleCase(s.tier)}</span> ${s.isPublic ? '<span class="pill pill--ok">public</span>' : '<span class="pill">private</span>'}
                <br><small class="card-muted">${s.districtId ? esc((ds.find((d) => d.id === s.districtId) || {}).name || "District") : "State-level"} · ${s._count?.payments || 0} payment(s)</small></div>
              <div class="row">
                <button class="btn-ghost btn-small" data-act="reqPay" data-id="${s.id}" data-name="${esc(s.name)}">Request payment</button>
                <button class="btn-ghost btn-small" data-act="editSp" data-id="${s.id}">Edit</button>
                <button class="btn-ghost btn-small btn-danger" data-act="delSp" data-id="${s.id}">Delete</button>
              </div>
              <div class="pv-form" id="spedit-${s.id}" hidden style="width:100%;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
                <label>Name<input name="name" value="${esc(s.name)}"></label>
                <div class="form-row">
                  <label>Tier<select name="tier">${["PLATINUM", "GOLD", "SILVER", "BRONZE", "COMMUNITY"].map((x) => `<option ${x === s.tier ? "selected" : ""}>${x}</option>`).join("")}</select></label>
                  <label>Website<input name="website" value="${esc(s.website || "")}"></label>
                </div>
                <label class="row" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="isPublic" ${s.isPublic ? "checked" : ""} style="width:auto"> Show on the public sponsors page</label>
                <button class="btn btn-primary btn-small" data-act="saveSp" data-id="${s.id}">Save</button>
              </div>
            </div>`).join("") || '<p class="card-muted">No sponsors.</p>'}</div>
        </div>
        <div class="card" style="margin-top:16px"><h2>District ledger</h2>
          ${logs.length ? `<div class="table-wrap"><table class="pv-table"><thead><tr><th>Date</th><th>Name</th><th>Type</th><th>Amount</th><th>Notes</th></tr></thead>
          <tbody>${logs.map((l) => `<tr><td>${fmtDate(l.createdAt)}</td><td>${esc(l.sponsorName)}</td><td>${titleCase(l.type)}</td><td>${money(l.amount)}</td><td>${esc(l.notes || "")}</td></tr>`).join("")}</tbody></table></div>`
          : '<p class="card-muted">No entries.</p>'}
        </div>`;
    },
    after: () => {
      view().addEventListener("click", async (e) => {
        const t = e.target.closest("[data-act]");
        if (!t) return;
        try {
          busy(t, true, "…");
          if (t.dataset.act === "addSponsor") {
            const d = readForm($("#spForm"));
            const f = $("#spLogo").files[0];
            if (f) d.logoUrl = await api.upload(f);
            await api.post("/sponsors", d);
            setMsg("spMsg", "Sponsor added.", true);
            render();
          } else if (t.dataset.act === "addLog") {
            await api.post(`/sponsors/districts/${me.districtId}/logs`, readForm($("#logForm")));
            setMsg("logMsg", "Recorded.", true);
            render();
          } else if (t.dataset.act === "reqPay") {
            busy(t, false);
            const amount = Number(prompt(`Payment amount (₹) to request from ${t.dataset.name}:`));
            if (!amount || amount <= 0) return;
            const note = prompt("Note for the invoice (optional):") || undefined;
            const { payUrl } = await api.post(`/payments/sponsors/${t.dataset.id}/request`, { amount, note });
            openModal("Payment link created", `<p class="card-muted">Send this link to the sponsor. They pay and get an invoice — no login needed.</p>
              <input class="btn-ghost" style="width:100%" readonly value="${esc(payUrl)}" onclick="this.select()">`);
          } else if (t.dataset.act === "editSp") {
            busy(t, false);
            const box = document.getElementById("spedit-" + t.dataset.id);
            if (box) box.hidden = !box.hidden;
          } else if (t.dataset.act === "saveSp") {
            await api.patch(`/sponsors/${t.dataset.id}`, readForm(document.getElementById("spedit-" + t.dataset.id)));
            toast("Sponsor updated", "ok");
            render();
          } else if (t.dataset.act === "delSp") {
            busy(t, false);
            if (!confirm("Delete this sponsor?")) return;
            await api.del(`/sponsors/${t.dataset.id}`);
            toast("Sponsor deleted", "ok");
            render();
          }
        } catch (err) {
          if (["addSponsor", "addLog"].includes(t.dataset.act)) setMsg(t.dataset.act === "addSponsor" ? "spMsg" : "logMsg", err.message, false);
          else toast(err.message, "error");
          busy(t, false);
        }
      });
    },
  });

  /* ---------- District report ---------- */
  R("/admin/reports", "District Report", {
    role: "DISTRICT_ADMIN",
    render: async () => {
      const { reports } = await api.get("/reports");
      const month = new Date().toISOString().slice(0, 7);
      return `
        <div class="pv-head"><h1>Monthly District Report</h1><p>One page each month for the State Committee.</p></div>
        <div class="card" style="max-width:520px"><h2>Submit ${month}</h2>
          <div class="pv-form" id="repForm" style="margin-top:10px">
            <input type="hidden" name="month" value="${month}-01">
            <div class="form-row"><label>Events run<input type="number" name="eventsRun" value="0"></label>
            <label>Teams managed<input type="number" name="teamsManaged" value="0"></label></div>
            <label>Summary / notes<textarea name="summary"></textarea></label>
            <button class="btn btn-primary" data-act="submitReport">Submit</button><span class="pv-msg" id="repMsg"></span>
          </div>
        </div>
        <div class="card" style="margin-top:16px"><h2>Past reports</h2>
          ${reports.length ? `<div class="table-wrap"><table class="pv-table"><thead><tr><th>Month</th><th>Events</th><th>Teams</th><th>Summary</th></tr></thead>
          <tbody>${reports.map((r) => `<tr><td>${fmtDate(r.month, { month: "long", year: "numeric" })}</td><td>${r.eventsRun}</td><td>${r.teamsManaged}</td><td>${esc(r.summary || "")}</td></tr>`).join("")}</tbody></table></div>`
          : '<p class="card-muted">No reports yet.</p>'}
        </div>`;
    },
    after: () => {
      view().addEventListener("click", async (e) => {
        const t = e.target.closest('[data-act="submitReport"]');
        if (!t) return;
        busy(t, true, "…");
        try {
          await api.post("/reports", readForm($("#repForm")));
          setMsg("repMsg", "Submitted.", true);
          render();
        } catch (err) { setMsg("repMsg", err.message, false); busy(t, false); }
      });
    },
  });

  /* ---------- Documents ---------- */
  R("/admin/documents", "Documents", {
    role: "DISTRICT_ADMIN",
    render: async () => {
      const isState = can("STATE_ADMIN");
      const [{ documents }, ds] = await Promise.all([
        api.get("/admin/documents"),
        isState ? districts() : Promise.resolve([]),
      ]);
      const VIS = ["DISTRICT_ONLY", "STATE_ONLY", "PUBLIC"];
      const TYPES = ["BYLAW", "MINUTES", "CIRCULAR", "OTHER"];
      const districtField = isState
        ? `<label>District<select name="districtId"><option value="">— none (state / public) —</option>${ds.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select></label>`
        : "";
      return `
        <div class="pv-head"><h1>Official Documents</h1><p>Bylaws, meeting minutes and circulars. Files are stored privately — access follows the visibility you set.</p></div>
        <div class="card" style="max-width:560px"><h2>Upload</h2>
          <div class="pv-form" id="docForm" style="margin-top:10px">
            <label>Title<input name="title"></label>
            <div class="form-row">
              <label>Type<select name="type">${TYPES.map((x) => `<option>${x}</option>`).join("")}</select></label>
              <label>Visibility<select name="visibility">${VIS.map((x) => `<option>${x}</option>`).join("")}</select></label>
            </div>
            ${districtField}
            <label>File (PDF, Word, image or text — max 20 MB)<input type="file" id="docFile" accept="application/pdf,image/*,.doc,.docx,.txt"></label>
            <button class="btn btn-primary" data-act="uploadDoc">Upload</button><span class="pv-msg" id="docMsg"></span>
          </div>
        </div>
        <div class="card" style="margin-top:16px"><h2>Library (${documents.length})</h2>
          <div class="list" style="margin-top:10px" id="docList">${documents.length ? documents.map((d) => docRow(d, isState, ds)).join("") : '<p class="card-muted">Empty.</p>'}</div>
        </div>`;
    },
    after: () => {
      view().addEventListener("click", async (e) => {
        const t = e.target.closest("[data-act]");
        if (!t) return;
        const act = t.dataset.act;
        if (act === "uploadDoc") {
          const f = $("#docFile").files[0];
          if (!f) return setMsg("docMsg", "Choose a file.", false);
          const d = readForm($("#docForm"));
          if (!d.title) return setMsg("docMsg", "Give it a title.", false);
          const fd = new FormData();
          fd.append("file", f);
          fd.append("title", d.title);
          fd.append("type", d.type);
          fd.append("visibility", d.visibility);
          if (d.districtId) fd.append("districtId", d.districtId);
          busy(t, true, "Uploading…");
          try {
            await api.post("/admin/documents", fd, { isForm: true });
            setMsg("docMsg", "Uploaded.", true);
            render();
          } catch (err) { setMsg("docMsg", err.message, false); busy(t, false); }
        } else if (act === "openDoc") {
          try { await api.openFile(`/admin/documents/${t.dataset.id}/file`); }
          catch (err) { toast(err.message, "error"); }
        } else if (act === "editDoc") {
          const box = document.getElementById("edit-" + t.dataset.id);
          if (box) box.hidden = !box.hidden;
        } else if (act === "saveDoc") {
          const form = document.getElementById("edit-" + t.dataset.id);
          busy(t, true, "…");
          try {
            await api.patch(`/admin/documents/${t.dataset.id}`, readForm(form));
            toast("Saved", "ok");
            render();
          } catch (err) { toast(err.message, "error"); busy(t, false); }
        } else if (act === "delDoc") {
          if (!confirm("Delete this document permanently?")) return;
          try { await api.del(`/admin/documents/${t.dataset.id}`); render(); }
          catch (err) { toast(err.message, "error"); }
        }
      });
    },
  });

  function docRow(d, isState, ds) {
    const TYPES = ["BYLAW", "MINUTES", "CIRCULAR", "OTHER"];
    const VIS = ["DISTRICT_ONLY", "STATE_ONLY", "PUBLIC"];
    const kb = d.fileSize ? " · " + Math.max(1, Math.round(d.fileSize / 1024)) + " KB" : "";
    const districtField = isState
      ? `<label>District<select name="districtId"><option value="">— none —</option>${(ds || []).map((x) => `<option value="${x.id}" ${x.id === d.districtId ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>`
      : "";
    return `<div class="list-item" style="flex-wrap:wrap">
      <div class="li-main">
        <strong>${esc(d.title)}</strong>
        <small>${titleCase(d.type)} · ${titleCase(d.visibility)}${d.district ? " · " + esc(d.district.name) : ""}${kb} · ${fmtDate(d.createdAt)}${d.uploadedBy ? " · by " + esc(d.uploadedBy.fullName) : ""}</small>
      </div>
      <div class="row">
        ${d.hasFile ? `<button class="btn-ghost btn-small" data-act="openDoc" data-id="${d.id}">Open</button>` : ""}
        <button class="btn-ghost btn-small" data-act="editDoc" data-id="${d.id}">Edit</button>
        <button class="btn-ghost btn-small btn-danger" data-act="delDoc" data-id="${d.id}">Delete</button>
      </div>
      <div class="pv-form" id="edit-${d.id}" hidden style="width:100%;margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
        <label>Title<input name="title" value="${esc(d.title)}"></label>
        <div class="form-row">
          <label>Type<select name="type">${TYPES.map((x) => `<option ${x === d.type ? "selected" : ""}>${x}</option>`).join("")}</select></label>
          <label>Visibility<select name="visibility">${VIS.map((x) => `<option ${x === d.visibility ? "selected" : ""}>${x}</option>`).join("")}</select></label>
        </div>
        ${districtField}
        <button class="btn btn-primary btn-small" data-act="saveDoc" data-id="${d.id}">Save changes</button>
      </div>
    </div>`;
  }

  /* ---------- State overview ---------- */
  R("/admin/overview", "State Overview", {
    role: "STATE_ADMIN",
    render: async () => {
      const [ov, ds, trends] = await Promise.all([
        api.get("/reports/state-overview"),
        districts(),
        api.get("/reports/trends").catch(() => ({ series: [], districts: [] })),
      ]);
      const s = trends.series || [];
      const maxNew = Math.max(1, ...s.map((x) => x.newMembers));
      const maxFee = Math.max(1, ...s.map((x) => x.feesCollected));
      const bars = (key, max, colour) =>
        s.map((x) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
          <div title="${x[key]}" style="width:70%;height:${Math.round((x[key] / max) * 90) + 2}px;background:${colour};border-radius:3px 3px 0 0"></div>
          <small style="font-size:.6rem;color:var(--muted-soft)">${x.month.slice(5)}</small></div>`).join("");
      return `
        <div class="pv-head"><h1>State Overview</h1></div>
        <div class="grid grid-4">
          <div class="stat"><span>Total members</span><strong>${ov.totalMembers}</strong></div>
          <div class="stat"><span>Active</span><strong>${ov.activeMembers}</strong></div>
          <div class="stat"><span>Districts</span><strong>${ov.districts}</strong></div>
          <div class="stat"><span>Fees collected</span><strong>${money(ov.feesCollected)}</strong></div>
        </div>
        ${s.length ? `<div class="grid grid-2" style="margin-top:16px">
          <div class="card"><h3>New members · last 12 months</h3><div style="display:flex;align-items:flex-end;gap:3px;height:120px;margin-top:10px">${bars("newMembers", maxNew, "rgba(212,175,55,.55)")}</div></div>
          <div class="card"><h3>Fee collection · last 12 months</h3><div style="display:flex;align-items:flex-end;gap:3px;height:120px;margin-top:10px">${bars("feesCollected", maxFee, "rgba(47,155,97,.55)")}</div></div>
        </div>` : ""}
        <div class="card" style="margin-top:16px"><h2>Districts</h2>
          <div class="table-wrap"><table class="pv-table"><thead><tr><th>District</th><th>Region</th><th>Units</th><th>Members</th></tr></thead>
          <tbody>${ds.map((d) => `<tr><td>${esc(d.name)}</td><td>${esc(d.region || "")}</td><td>${d._count?.units ?? "—"}</td><td>${d._count?.members ?? "—"}</td></tr>`).join("")}</tbody></table></div>
        </div>`;
    },
  });

  /* ---------- Roles & audit ---------- */
  R("/admin/roles", "Roles & Audit", {
    role: "STATE_ADMIN",
    render: async () => {
      const { logs } = await api.get("/admin/audit-logs");
      return `
        <div class="pv-head"><h1>Roles &amp; Audit</h1><p>Role changes are made from the Members table. This is the full audit trail.</p></div>
        <div class="card"><h2>Recent activity (${logs.length})</h2>
          <div class="table-wrap"><table class="pv-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead>
          <tbody>${logs.map((l) => `<tr><td>${fmtDateTime(l.createdAt)}</td><td>${esc(l.actor?.fullName || "—")} <small class="card-muted">(${titleCase(l.actor?.role || "")})</small></td><td>${titleCase(l.action)}</td><td>${esc(l.entityType)} · ${esc(l.entityId.slice(0, 8))}</td></tr>`).join("") || '<tr><td colspan="4">No entries.</td></tr>'}</tbody></table></div>
        </div>`;
    },
  });

  /* ---------- Broadcast ---------- */
  R("/admin/broadcast", "Broadcast", {
    role: "DISTRICT_ADMIN",
    render: async () => {
      const isState = can("STATE_ADMIN");
      const ds = isState ? await districts() : [];
      const audience = isState
        ? `<label>Audience<select name="districtId"><option value="">Every district (state-wide)</option>${ds.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select></label>`
        : `<label>Audience<input value="Your district only" disabled></label>`;
      return `
        <div class="pv-head"><h1>Broadcast</h1><p>${isState ? "Send a notification to every active member, or one district." : "Send a notification to every active member in your district."}</p></div>
        <div class="card" style="max-width:520px">
          <div class="pv-form" id="bcForm">
            <label>Title<input name="title"></label>
            <label>Message<textarea name="body"></textarea></label>
            <div class="form-row">
              <label>Category<select name="category"><option>ANNOUNCEMENT</option><option>EVENT</option><option>NEWS</option><option>PAYMENT</option></select></label>
              ${audience}
            </div>
            <button class="btn btn-primary" data-act="sendBc">Send broadcast</button><span class="pv-msg" id="bcMsg"></span>
          </div>
        </div>`;
    },
    after: () => {
      view().addEventListener("click", async (e) => {
        const t = e.target.closest('[data-act="sendBc"]');
        if (!t) return;
        busy(t, true, "Sending…");
        try {
          const { sent } = await api.post("/notifications/broadcast", readForm($("#bcForm")));
          setMsg("bcMsg", `Sent to ${sent} members.`, true);
        } catch (err) { setMsg("bcMsg", err.message, false); }
        finally { busy(t, false); }
      });
    },
  });

  /* ---------- Store products (state) ---------- */
  R("/admin/store-admin", "Store Products", {
    role: "STATE_ADMIN",
    render: async () => {
      const { products } = await api.get("/store/products?all=true");
      return `
        <div class="pv-head"><h1>Store Products</h1></div>
        <div class="card" style="max-width:560px"><h2>Add product</h2>
          <div class="pv-form" id="prodForm" style="margin-top:10px">
            <label>Name<input name="name"></label>
            <label>Description<input name="description"></label>
            <div class="form-row"><label>Category<input name="category" value="JERSEY"></label>
            <label>Sizes (comma sep)<input name="sizesAvailable" value="S,M,L,XL"></label></div>
            <div class="form-row"><label>Price ₹<input type="number" name="price"></label>
            <label>Member price ₹<input type="number" name="memberPrice"></label>
            <label>Stock<input type="number" name="stock" value="0"></label></div>
            <label>Image<input type="file" id="prodImg" accept="image/*"></label>
            <button class="btn btn-primary" data-act="addProd">Add</button><span class="pv-msg" id="prodMsg"></span>
          </div>
        </div>
        <div class="card" style="margin-top:16px"><h2>Catalogue (${products.length})</h2>
          <div class="stack" style="margin-top:10px">${products.map((p) => `
            <div class="list-item" style="flex-wrap:wrap">
              <div class="li-main"><strong>${esc(p.name)}</strong> ${p.isActive ? "" : '<span class="pill pill--bad">hidden</span>'}<br><small class="card-muted">${money(p.price)} · member ${money(p.memberPrice)} · stock ${p.stock}</small></div>
              <div class="pv-form" id="pedit-${p.id}" hidden style="width:100%;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
                <div class="form-row">
                  <label>Price ₹<input type="number" name="price" value="${p.price}"></label>
                  <label>Member ₹<input type="number" name="memberPrice" value="${p.memberPrice}"></label>
                  <label>Stock<input type="number" name="stock" value="${p.stock}"></label>
                </div>
                <label class="row" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="isActive" ${p.isActive ? "checked" : ""} style="width:auto"> Visible in the store</label>
                <button class="btn btn-primary btn-small" data-act="saveProd" data-id="${p.id}">Save</button>
              </div>
              <button class="btn-ghost btn-small" data-act="editProd" data-id="${p.id}">Edit</button>
            </div>`).join("") || '<p class="card-muted">No products.</p>'}</div>
        </div>`;
    },
    after: () => {
      view().addEventListener("click", async (e) => {
        const add = e.target.closest('[data-act="addProd"]');
        if (add) {
          const d = readForm($("#prodForm"));
          d.sizesAvailable = String(d.sizesAvailable || "").split(",").map((s) => s.trim()).filter(Boolean);
          busy(add, true, "…");
          try {
            const f = $("#prodImg").files[0];
            if (f) d.imageUrl = await api.upload(f);
            await api.post("/store/products", d);
            setMsg("prodMsg", "Product added.", true);
            render();
          } catch (err) { setMsg("prodMsg", err.message, false); busy(add, false); }
          return;
        }
        const ed = e.target.closest('[data-act="editProd"]');
        if (ed) {
          const box = document.getElementById("pedit-" + ed.dataset.id);
          if (box) box.hidden = !box.hidden;
          return;
        }
        const sv = e.target.closest('[data-act="saveProd"]');
        if (sv) {
          busy(sv, true, "…");
          try {
            await api.patch(`/store/products/${sv.dataset.id}`, readForm(document.getElementById("pedit-" + sv.dataset.id)));
            toast("Saved", "ok");
            render();
          } catch (err) { toast(err.message, "error"); busy(sv, false); }
        }
      });
    },
  });

  /* ---------- Feedback (member + committee) ---------- */
  R("/feedback", "Feedback", {
    render: async () => {
      const { feedback } = await api.get("/feedback/me");
      return `
        <div class="pv-head"><h1>Feedback to your unit</h1><p>Reaches your unit and district committee directly. You'll get a notification when they reply.</p></div>
        <div class="card" style="max-width:560px"><h2>New feedback</h2>
          <div class="pv-form" id="fbForm" style="margin-top:10px">
            <label>Subject<input name="subject"></label>
            <label>Message<textarea name="message"></textarea></label>
            <button class="btn btn-primary" data-act="sendFb">Send</button><span class="pv-msg" id="fbMsg"></span>
          </div>
        </div>
        <div class="card" style="margin-top:16px"><h2>Your messages</h2>
          <div class="list" style="margin-top:10px">${feedback.length ? feedback.map((f) => `
            <div class="card"><div class="row-between"><strong>${esc(f.subject)}</strong><span class="pill ${f.status === "RESOLVED" ? "pill--ok" : f.status === "ACKNOWLEDGED" ? "pill--warn" : ""}">${titleCase(f.status)}</span></div>
              <p style="white-space:pre-wrap;margin:8px 0">${esc(f.message)}</p>
              ${f.response ? `<div style="border-left:3px solid var(--gold);padding-left:12px"><small class="card-muted">Reply from ${esc(f.handledBy?.fullName || "your unit")}</small><p style="white-space:pre-wrap;margin:4px 0 0">${esc(f.response)}</p></div>` : ""}
              <small class="card-muted">${fmtDateTime(f.createdAt)}</small></div>`).join("") : '<p class="card-muted">Nothing sent yet.</p>'}</div>
        </div>`;
    },
    after: () => {
      view().addEventListener("click", async (e) => {
        const t = e.target.closest('[data-act="sendFb"]');
        if (!t) return;
        const d = readForm($("#fbForm"));
        if (!d.subject || !d.message) return setMsg("fbMsg", "Add a subject and message.", false);
        busy(t, true, "Sending…");
        try {
          await api.post("/feedback", d);
          setMsg("fbMsg", "Sent to your unit.", true);
          render();
        } catch (err) { setMsg("fbMsg", err.message, false); busy(t, false); }
      });
    },
  });

  R("/admin/feedback", "Feedback Inbox", {
    role: "UNIT_ADMIN",
    render: async () => {
      const { feedback } = await api.get("/feedback");
      return `
        <div class="pv-head"><h1>Feedback Inbox</h1><p>${can("DISTRICT_ADMIN") ? "All feedback across your district." : "Feedback from your unit's members."}</p></div>
        ${feedback.length ? `<div class="list">${feedback.map((f) => `
          <div class="card" data-fb="${f.id}">
            <div class="row-between"><div><strong>${esc(f.subject)}</strong><br><small class="card-muted">${esc(f.author?.fullName)} · ${esc(f.unit?.name)} · ${fmtDateTime(f.createdAt)}</small></div>
              <select class="btn-ghost btn-small" data-act="fbStatus" data-id="${f.id}">${["OPEN", "ACKNOWLEDGED", "RESOLVED"].map((s) => `<option ${s === f.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
            <p style="white-space:pre-wrap;margin:8px 0">${esc(f.message)}</p>
            ${f.response ? `<p class="card-muted">Replied: ${esc(f.response)}</p>` : `
            <div class="pv-form"><textarea id="resp-${f.id}" placeholder="Write a reply to the member…"></textarea>
            <button class="btn btn-primary btn-small" data-act="fbReply" data-id="${f.id}">Send reply</button></div>`}
          </div>`).join("")}</div>` : '<div class="empty">No feedback yet.</div>'}`;
    },
    after: () => {
      view().addEventListener("click", async (e) => {
        const rep = e.target.closest('[data-act="fbReply"]');
        if (rep) {
          const response = document.getElementById("resp-" + rep.dataset.id).value.trim();
          if (!response) return toast("Write a reply first", "error");
          busy(rep, true, "…");
          try { await api.patch(`/feedback/${rep.dataset.id}`, { response, status: "RESOLVED" }); toast("Reply sent", "ok"); render(); }
          catch (err) { toast(err.message, "error"); busy(rep, false); }
        }
      });
      view().addEventListener("change", async (e) => {
        const st = e.target.closest('[data-act="fbStatus"]');
        if (!st) return;
        try { await api.patch(`/feedback/${st.dataset.id}`, { status: st.value }); toast("Updated", "ok"); }
        catch (err) { toast(err.message, "error"); render(); }
      });
    },
  });

  /* ---------- Store orders (committee) ---------- */
  R("/admin/orders", "Store Orders", {
    role: "DISTRICT_ADMIN",
    render: async () => {
      const status = currentQuery().status || "";
      const { orders } = await api.get("/store/orders" + (status ? "?status=" + status : ""));
      const STATUSES = ["", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
      return `
        <div class="pv-head"><h1>Store Orders</h1><p>Track and fulfil member orders.</p></div>
        <div class="pv-tabs">${STATUSES.map((s) => `<button class="${s === status ? "is-active" : ""}" data-act="ostatus" data-s="${s}">${s || "All"}</button>`).join("")}</div>
        ${orders.length ? `<div class="list">${orders.map((o) => `
          <div class="card"><div class="row-between">
            <div><strong>${money(o.totalAmount)}</strong> · <span class="pill">${titleCase(o.status)}</span><br>
            <small class="card-muted">${esc(o.member?.fullName)} (${esc(o.member?.memberNumber)}) · ${esc(o.member?.district?.name || "")} · ${fmtDate(o.createdAt)}</small></div>
            <select class="btn-ghost btn-small" data-act="ofulfil" data-id="${o.id}">
              <option value="">Set status…</option>${["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map((s) => `<option>${s}</option>`).join("")}
            </select>
          </div>
          <small class="card-muted">${o.items.map((i) => `${esc(i.product?.name)} ×${i.quantity}`).join(", ")}</small><br>
          <small class="card-muted">Ship to: ${esc(o.shippingAddress || "—")}</small></div>`).join("")}</div>` : '<div class="empty">No orders.</div>'}`;
    },
    after: () => {
      view().addEventListener("click", (e) => {
        const t = e.target.closest('[data-act="ostatus"]');
        if (t) location.hash = "#/admin/orders" + (t.dataset.s ? "?status=" + t.dataset.s : "");
      });
      view().addEventListener("change", async (e) => {
        const t = e.target.closest('[data-act="ofulfil"]');
        if (!t || !t.value) return;
        try { await api.patch(`/store/orders/${t.dataset.id}/status`, { status: t.value }); toast("Order updated", "ok"); render(); }
        catch (err) { toast(err.message, "error"); }
      });
    },
  });

  /* ---------- All district reports (state) ---------- */
  R("/admin/all-reports", "District Reports", {
    role: "STATE_ADMIN",
    render: async () => {
      const { reports } = await api.get("/reports");
      if (!reports.length) return `<div class="pv-head"><h1>District Reports</h1></div><div class="empty">No districts have submitted a report yet.</div>`;
      return `<div class="pv-head"><h1>District Monthly Reports</h1><p>Every district's submissions, newest first.</p></div>
        <div class="table-wrap"><table class="pv-table"><thead><tr><th>Month</th><th>District</th><th>Events</th><th>Teams</th><th>Summary</th><th>By</th></tr></thead>
        <tbody>${reports.map((r) => `<tr>
          <td>${fmtDate(r.month, { month: "short", year: "numeric" })}</td>
          <td>${esc(r.district?.name || "—")}</td>
          <td>${r.eventsRun}</td><td>${r.teamsManaged}</td>
          <td>${esc(r.summary || "")}</td>
          <td>${esc(r.submittedBy?.fullName || "")}</td></tr>`).join("")}</tbody></table></div>`;
    },
  });

  /* ================================================================
   * shared small helpers used by routes
   * ============================================================== */
  function setMsg(id, text, ok) {
    const el = $("#" + id);
    if (!el) return toast(text, ok ? "ok" : "error");
    el.textContent = text;
    el.className = "pv-msg " + (ok ? "pv-msg--ok" : "pv-msg--error");
  }
  function tabWiring() {
    view().querySelectorAll(".pv-tabs button").forEach((b) => {
      b.onclick = () => {
        view().querySelectorAll(".pv-tabs button").forEach((x) => x.classList.toggle("is-active", x === b));
        view().querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
      };
    });
  }
  function currentQuery() {
    const q = (location.hash.split("?")[1] || "");
    return Object.fromEntries(new URLSearchParams(q));
  }

  /* ================================================================
   * global delegated actions (events RSVP, polls vote, cricket, trials)
   * ============================================================== */
  function wireGlobalActions() {
    view().addEventListener("click", async (e) => {
      const t = e.target.closest("[data-act]");
      if (!t) return;
      const act = t.dataset.act;

      if (act === "rsvp") {
        busy(t, true, "…");
        try {
          await api.post(`/events/${t.dataset.id}/rsvp`, { status: t.dataset.status });
          toast("RSVP saved", "ok");
        } catch (err) { toast(err.message, "error"); }
        finally { busy(t, false); }
      }

      if (act === "vote") {
        try {
          await api.post(`/polls/options/${t.dataset.id}/vote`, {});
          render();
        } catch (err) { toast(err.message, "error"); }
      }

      if (act === "team") {
        try {
          const { team } = await api.get(`/cricket/teams/${t.dataset.id}`);
          openModal(
            team.name,
            `<small class="card-muted">Season ${esc(team.season)}</small>
             <div class="list" style="margin-top:10px">${(team.players || []).map((p) => `<div class="list-item"><div class="li-main"><strong>${esc(p.member?.fullName || "Player")}</strong><small>${esc(p.position || "")}${p.jerseyNumber ? " · #" + p.jerseyNumber : ""}</small></div></div>`).join("") || '<p class="card-muted">No players yet.</p>'}</div>`
          );
        } catch (err) { toast(err.message, "error"); }
      }

      if (act === "predict") {
        openModal(
          "Predict the winner",
          `<div class="row"><button class="btn btn-outline" data-pick="${t.dataset.home}">${esc(t.dataset.hn)}</button>
           <button class="btn btn-outline" data-pick="${t.dataset.away}">${esc(t.dataset.an)}</button></div>`,
          (modal) => {
            modal.querySelectorAll("[data-pick]").forEach((b) => {
              b.onclick = async () => {
                try {
                  await api.post(`/cricket/matches/${t.dataset.id}/predict`, { predictedWinnerTeamId: b.dataset.pick });
                  toast("Prediction saved", "ok");
                  closeModal();
                } catch (err) { toast(err.message, "error"); }
              };
            });
          }
        );
      }

      if (act === "applyTrial") {
        busy(t, true, "…");
        try {
          await api.post(`/cricket/trials/${t.dataset.id}/apply`, {});
          toast("Application submitted", "ok");
          t.textContent = "Applied ✓";
        } catch (err) { toast(err.message, "error"); busy(t, false); }
      }
    });
  }

  /* ---- modal ---- */
  function openModal(title, html, after) {
    closeModal();
    const wrap = document.createElement("div");
    wrap.id = "portalModal";
    wrap.style.cssText = "position:fixed;inset:0;z-index:90;display:grid;place-items:center;background:rgba(0,0,0,.6);padding:20px";
    wrap.innerHTML = `<div class="card" style="max-width:480px;width:100%;max-height:85vh;overflow:auto">
      <div class="row-between"><h2>${esc(title)}</h2><button class="btn-ghost btn-small" data-close>✕</button></div>
      <div style="margin-top:12px">${html}</div></div>`;
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || e.target.closest("[data-close]")) closeModal();
    });
    document.body.appendChild(wrap);
    if (after) after(wrap);
  }
  function closeModal() {
    const m = $("#portalModal");
    if (m) m.remove();
  }

  /* ================================================================
   * boot + router
   * ============================================================== */
  let currentRoute = null;

  function parseHash() {
    const raw = (location.hash || "#/").slice(1);
    const path = "/" + raw.split("?")[0].replace(/^\/+/, "");
    return path === "/" ? "/" : path.replace(/\/$/, "");
  }

  async function render() {
    const path = parseHash();
    const route = routes[path] || routes["/"];
    if (route.role && !can(route.role)) {
      view().innerHTML = '<div class="empty">You don\'t have access to this section.</div>';
      return;
    }
    currentRoute = route;
    $("#portalTitle").textContent = route.title;
    setActiveNav();
    view().innerHTML = '<div class="empty">Loading…</div>';
    // strip previously attached one-off listeners by replacing the node
    try {
      const html = await route.render(currentQuery());
      // rebuild view node to drop old delegated listeners from after()
      const fresh = view().cloneNode(false);
      fresh.innerHTML = html;
      view().replaceWith(fresh);
      wireGlobalActions();
      if (route.after) await route.after();
      fresh.focus();
    } catch (err) {
      if (err && err.status === 401) return gotoLogin();
      view().innerHTML = `<div class="empty">Couldn't load this page.<br><small>${esc(err.message || err)}</small></div>`;
    }
    // close mobile nav
    $("#portalShell").classList.remove("nav-open");
    $("#portalScrim").hidden = true;
  }

  function renderWhoami() {
    $("#portalWhoami").innerHTML = `<strong>${esc(me.fullName)}</strong><span>${titleCase(me.role)}</span>`;
  }

  async function refreshBell() {
    try {
      const { notifications } = await api.get("/notifications/me");
      $("#bellDot").hidden = !notifications.some((n) => !n.readAt);
    } catch (_) {}
  }

  function gotoLogin() {
    location.replace("login.html");
  }

  async function boot() {
    if (!api || !api.isLoggedIn()) return gotoLogin();
    try {
      me = await api.me();
    } catch (e) {
      return gotoLogin();
    }
    $("#portalBoot").remove();
    $("#portalShell").hidden = false;
    buildNav();
    renderWhoami();
    refreshBell();
    setInterval(refreshBell, 60000);

    $("#logoutBtn").onclick = async () => {
      await api.logout();
      gotoLogin();
    };
    $("#portalMenuToggle").onclick = () => {
      const open = $("#portalShell").classList.toggle("nav-open");
      $("#portalScrim").hidden = !open;
    };
    $("#portalScrim").onclick = () => {
      $("#portalShell").classList.remove("nav-open");
      $("#portalScrim").hidden = true;
    };
    $("#portalNav").addEventListener("click", () => {
      if (window.innerWidth <= 960) {
        $("#portalShell").classList.remove("nav-open");
        $("#portalScrim").hidden = true;
      }
    });

    window.addEventListener("hashchange", render);
    if (!location.hash) location.hash = "#/";
    render();
  }

  boot();
})();
