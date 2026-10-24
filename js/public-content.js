/*
 * Makes the public marketing pages data-driven off the AKDFA API:
 *   - news.html    : live news feed + events calendar (filterable by district)
 *   - sponsors.html : live sponsor list
 *   - units.html    : districts "brought to life" — story, events, results
 * Each block only runs if its container exists and the API responds; otherwise
 * the page keeps whatever static content it shipped with.
 */
(function () {
  "use strict";
  const api = window.AKDFA;
  if (!api) return;

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1).toLowerCase();
  const D = (v, o) => (v ? new Date(v).toLocaleDateString("en-IN", o || { day: "numeric", month: "short", year: "numeric" }) : "");
  const dayNum = (v) => (v ? new Date(v).getDate() : "");
  const monShort = (v) => (v ? new Date(v).toLocaleDateString("en-IN", { month: "short" }) : "");

  /* ================= NEWS + EVENTS (news.html) ================= */
  const eventsList = document.getElementById("eventsList");
  const filterBar = document.getElementById("eventsFilterBar");
  const newsSection = document.getElementById("news");

  if (eventsList) {
    let districtMap = {};
    let activeDistrict = "";

    const renderEvents = (all) => {
      const events = all.filter((e) => e.type !== "CHARITY"); // the public calendar does not show a Charity category
      if (!events.length) {
        eventsList.innerHTML = '<p class="empty-state">No events scheduled yet — check back soon.</p>';
        return;
      }
      eventsList.innerHTML = events
        .map(
          (e) => `<article class="event-card" data-event-district="${esc(e.district ? e.district.name : "")}">
            <div class="event-date"><span class="event-date-day">${dayNum(e.startsAt)}</span><span class="event-date-month">${monShort(e.startsAt)}</span></div>
            <div class="event-body">
              <p class="eyebrow">${esc(cap(e.type))}${e.district ? " · " + esc(e.district.name) : ""}</p>
              <h3>${esc(e.title)}</h3>
              <p>${esc(e.location || "")}${e.location && e._count && e._count.rsvps ? " · " : ""}${e._count && e._count.rsvps ? e._count.rsvps + " attending" : ""}</p>
              ${e.description ? `<p>${esc(e.description)}</p>` : ""}
            </div>
          </article>`
        )
        .join("");
    };

    const loadEvents = async () => {
      const from = new Date(Date.now() - 7 * 86400000).toISOString();
      const q = new URLSearchParams({ from });
      if (activeDistrict) q.set("districtId", activeDistrict);
      try {
        const { events } = await api.get("/events?" + q.toString());
        renderEvents(events);
      } catch (_) {
        /* keep static markup */
      }
    };

    api
      .get("/districts")
      .then(({ districts }) => {
        districts.forEach((d) => (districtMap[d.id] = d.name));
        if (filterBar) {
          filterBar.innerHTML =
            `<button class="filter-btn event-filter-btn is-active" type="button" data-district-id="">All Districts</button>` +
            districts.map((d) => `<button class="filter-btn event-filter-btn" type="button" data-district-id="${d.id}">${esc(d.name)}</button>`).join("");
          filterBar.addEventListener("click", (ev) => {
            const b = ev.target.closest("[data-district-id]");
            if (!b) return;
            filterBar.querySelectorAll(".filter-btn").forEach((x) => x.classList.toggle("is-active", x === b));
            activeDistrict = b.dataset.districtId;
            loadEvents();
          });
        }
        loadEvents();
      })
      .catch(() => loadEvents());
  }

  if (newsSection && !document.getElementById("newsList")) {
    const holder = document.createElement("div");
    holder.className = "news-list";
    holder.id = "newsList";
    const inner = newsSection.querySelector(".section-inner");
    const press = newsSection.querySelector(".press-block");
    if (inner) inner.insertBefore(holder, press || null);
  }
  const newsList = document.getElementById("newsList");
  if (newsList) {
    api
      .get("/news")
      .then(({ posts }) => {
        if (!posts || !posts.length) return;
        newsList.innerHTML = posts
          .slice(0, 8)
          .map(
            (p) => `<article class="glass-card reveal is-visible" style="margin-bottom:16px">
              <p class="eyebrow">${esc(cap(p.scope))}${p.district ? " · " + esc(p.district.name) : ""} · ${esc(D(p.publishedAt))}</p>
              <h3>${esc(p.title)}</h3>
              ${p.coverImageUrl ? `<div class="image-frame"><img src="${esc(p.coverImageUrl)}" alt="" loading="lazy"></div>` : ""}
              <p style="white-space:pre-wrap">${esc(p.body)}</p>
              <small style="color:var(--muted-soft)">— ${esc(p.author ? p.author.fullName : "AKDFA")}</small>
            </article>`
          )
          .join("");
      })
      .catch(() => {});
  }

  /* ================= SPONSORS (sponsors.html) ================= */
  const sponsorGrid = document.getElementById("sponsorGrid");
  if (sponsorGrid) {
    api
      .get("/sponsors")
      .then(({ sponsors }) => {
        if (!sponsors || !sponsors.length) return;
        const order = ["PLATINUM", "GOLD", "SILVER", "BRONZE", "COMMUNITY"];
        sponsors.sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier));
        sponsorGrid.innerHTML = sponsors
          .map(
            (s) => `<article class="sponsor-slot reveal is-visible" style="gap:8px">
              ${s.logoUrl ? `<img src="${esc(s.logoUrl)}" alt="${esc(s.name)}" style="max-height:56px;object-fit:contain">` : `<i class="fa-solid fa-handshake" aria-hidden="true"></i>`}
              <span>${esc(s.name)}</span>
              <small style="color:var(--muted-soft);text-transform:uppercase;letter-spacing:.1em;font-size:.7rem">${esc(cap(s.tier))} partner</small>
              ${s.website ? `<a href="${esc(s.website)}" target="_blank" rel="noopener" style="font-size:.8rem">Visit</a>` : ""}
            </article>`
          )
          .join("");
      })
      .catch(() => {});
  }

  /* ================= DISTRICTS BROUGHT TO LIFE (units.html) ================= */
  const districtGrid = document.getElementById("districtGrid");
  const modal = document.getElementById("committeeModal");
  const modalTitle = document.getElementById("committeeTitle");
  const modalContent = document.getElementById("committeeContent");
  const modalEyebrow = document.getElementById("committeeEyebrow");

  if (districtGrid && modal && modalContent) {
    // static committeeData / openCommitteeModal come from script.js (classic script,
    // shared lexical scope). We take over with live data when the API answers.
    const staticData = typeof committeeData !== "undefined" ? committeeData : {};

    api
      .get("/districts")
      .then(({ districts }) => {
        if (!districts || !districts.length) return;
        districtGrid.innerHTML = districts
          .map(
            (d) => `<button class="unit-card district-unit reveal reveal-scale is-visible" type="button"
                data-district-id="${d.id}" data-district-name="${esc(d.name)}"
                aria-haspopup="dialog" aria-label="View ${esc(d.name)} district">${esc(d.name)}
                <small style="display:block;color:var(--muted-soft);font-weight:600;font-size:.72rem">${(d._count && d._count.units) || 0} units · ${(d._count && d._count.members) || 0} members</small>
              </button>`
          )
          .join("");

        districtGrid.addEventListener("click", async (ev) => {
          const card = ev.target.closest("[data-district-id]");
          if (!card) return;
          openShowcase(card.dataset.districtId, card.dataset.districtName);
        });
      })
      .catch(() => {});

    async function openShowcase(id, name) {
      const s = staticData[name] || staticData[name.replace(/ \(.*/, "")] || null;
      if (modalEyebrow) modalEyebrow.textContent = "AKDFA District";
      if (modalTitle) modalTitle.textContent = name;
      modalContent.innerHTML = '<p class="empty-state">Loading…</p>';
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");

      let data = {};
      try {
        data = await api.get("/districts/" + id + "/showcase");
      } catch (_) {}

      const story = (data.district && data.district.bio) || (s && s.community) || "";
      const contacts =
        s && s.roles
          ? `<div class="district-profile-block"><h4><i class="fa-solid fa-address-book"></i> Unit contacts</h4>
             <ul class="district-profile-list">${s.roles.map((r) => `<li>${esc(r[0])}: ${esc(r[1])}</li>`).join("")}</ul></div>`
          : "";
      const units =
        data.district && data.district.units && data.district.units.length
          ? `<div class="district-profile-block"><h4><i class="fa-solid fa-people-group"></i> Units</h4>
             <ul class="district-profile-list">${data.district.units.map((u) => `<li>${esc(u.name)}</li>`).join("")}</ul></div>`
          : "";
      const results =
        data.recentMatches && data.recentMatches.length
          ? `<div class="district-profile-block"><h4><i class="fa-solid fa-baseball"></i> Recent results</h4>
             <ul class="district-profile-list">${data.recentMatches.map((m) => `<li>${esc(m.homeTeam && m.homeTeam.name)} vs ${esc(m.awayTeam && m.awayTeam.name)}${m.resultSummary ? " — " + esc(m.resultSummary) : ""}</li>`).join("")}</ul></div>`
          : s && s.standout
            ? `<div class="district-profile-block"><h4><i class="fa-solid fa-star"></i> Standout match</h4><p>${esc(s.standout)}</p></div>`
            : "";
      modalContent.innerHTML =
        (story ? `<p>${esc(story)}</p>` : "") +
        `<div class="district-profile">${units}${results}${contacts}</div>` ||
        '<p class="empty-state">District details coming soon.</p>';
    }
  }
})();
