/*
 * Public sections that the State Committee fills from the member app (Content → Event):
 *   - news.html   : events calendar (filter by type) + Charity activities
 *   - gallery.html: photos attached to those events, grouped by event type, with a photo viewer
 *   - index.html  : a photo rail on the home page (hidden until there are photos)
 * The API only returns events added by a State admin, so nothing else can appear here.
 */
(function () {
  "use strict";
  const api = window.AKDFA;
  if (!api) return;

  const TYPES = { TOURNAMENT: "Tournament", CHARITY: "Charity", MATCH: "Match", MEETING: "Meeting", TRIAL: "Trial", OTHER: "Other" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const day = (d) => new Date(d).getDate();
  const mon = (d) => new Date(d).toLocaleDateString("en-IN", { month: "short" });
  const full = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const label = (t) => TYPES[t] || "Event";

  const chips = (host, items, active, onPick) => {
    host.innerHTML = items.map(([key, text]) => `<button class="filter-btn${key === active ? " is-active" : ""}" type="button" data-key="${esc(key)}" aria-pressed="${key === active}">${esc(text)}</button>`).join("");
    host.addEventListener("click", (e) => {
      const b = e.target.closest("[data-key]");
      if (!b) return;
      host.querySelectorAll(".filter-btn").forEach((x) => { x.classList.toggle("is-active", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      onPick(b.dataset.key);
    });
  };

  api.get("/events").then(({ events }) => {
    events = events || [];

    /* ---- Updates: calendar ---- */
    const cal = document.getElementById("eventsCalendar");
    if (cal) {
      const filters = document.getElementById("eventTypeFilters");
      const present = [...new Set(events.map((e) => e.type))];
      const draw = (type) => {
        const list = events.filter((e) => type === "ALL" || e.type === type);
        cal.innerHTML = list.length
          ? list.map((e) => `<article class="event-card is-visible">
              <div class="event-date"><span class="event-date-day">${day(e.startsAt)}</span><span class="event-date-month">${mon(e.startsAt)}</span></div>
              <div class="event-body">
                <span class="badge">${esc(label(e.type))}</span>
                <h3>${esc(e.title)}</h3>
                <p class="meta">${esc(full(e.startsAt))}${e.location ? " | " + esc(e.location) : ""}${e.district ? " | " + esc(e.district.name) : ""}</p>
                ${e.description ? `<p>${esc(e.description)}</p>` : ""}
              </div></article>`).join("")
          : '<p class="empty-state">No events to show yet.</p>';
      };
      if (filters && present.length > 1) chips(filters, [["ALL", "All"], ...present.map((t) => [t, label(t)])], "ALL", draw);
      else if (filters) filters.hidden = true;
      draw("ALL");
    }

    /* ---- Updates: charity activities ---- */
    const charity = document.getElementById("charityList");
    if (charity) {
      const items = events.filter((e) => e.type === "CHARITY").sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));
      const section = document.getElementById("charity");
      if (!items.length) { if (section) section.hidden = true; }
      else {
        charity.innerHTML = items.map((e) => `<article class="activity-card is-visible" data-id="${esc(e.id)}"><span class="badge">Charity</span><h3>${esc(e.title)}</h3>
          <p class="meta">${esc(full(e.startsAt))}${e.district ? " | " + esc(e.district.name) : ""}${e.location ? " | " + esc(e.location) : ""}</p>
          ${e.description ? `<p>${esc(e.description)}</p>` : ""}<p class="meta report" hidden></p></article>`).join("");
        // enrich with the charity report (people helped, beneficiary) when one has been filed
        items.slice(0, 9).forEach((e) => api.get(`/events/${encodeURIComponent(e.id)}/charity-report`).then(({ report }) => {
          if (!report) return;
          const el = charity.querySelector(`[data-id="${CSS.escape(e.id)}"] .report`);
          const bits = [report.peopleHelped ? `${report.peopleHelped} people helped` : "", report.beneficiary ? `for ${report.beneficiary}` : ""].filter(Boolean);
          if (el && bits.length) { el.textContent = bits.join(" ") ; el.hidden = false; }
        }).catch(() => {}));
      }
    }

    /* ---- Gallery ---- */
    const grid = document.getElementById("galleryGrid");
    if (grid) {
      const photos = events.flatMap((e) => (e.photos || []).map((url) => ({ url, title: e.title, type: e.type })));
      const empty = document.getElementById("galleryEmpty");
      if (!photos.length) { if (empty) empty.hidden = false; }
      else {
        const present = [...new Set(photos.map((p) => p.type))];
        const draw = (type) => {
          grid.innerHTML = photos.filter((p) => type === "ALL" || p.type === type).map((p) =>
            `<article class="gallery-tile is-visible"><img src="${esc(p.url)}" alt="${esc(p.title)}" loading="lazy" decoding="async"><span>${esc(p.title)}</span></article>`).join("");
        };
        const filters = document.getElementById("galleryFilters");
        if (filters && present.length > 1) chips(filters, [["ALL", "All"], ...present.map((t) => [t, label(t)])], "ALL", draw);
        else if (filters) filters.hidden = true;
        draw("ALL");
      }
    }

    /* ---- Home: photo rail ---- */
    const rail = document.getElementById("homePhotosRail");
    if (rail) {
      const photos = events.flatMap((e) => (e.photos || []).map((url) => ({ url, title: e.title }))).slice(0, 10);
      if (photos.length) {
        rail.innerHTML = photos.map((p) => `<img src="${esc(p.url)}" alt="${esc(p.title)}" loading="lazy">`).join("");
        document.getElementById("homePhotos").hidden = false;
      }
    }
  }).catch(() => {
    const cal = document.getElementById("eventsCalendar");
    if (cal) cal.innerHTML = '<p class="empty-state">Events could not be loaded right now.</p>';
  });

  /* ---- Home: social media the State Committee has added ---- */
  const socialBox = document.getElementById("homeSocialLinks");
  if (socialBox && window.AKDFA) {
    const ICON = { facebook: "fa-facebook-f", instagram: "fa-instagram", x: "fa-x-twitter", youtube: "fa-youtube", whatsapp: "fa-whatsapp", telegram: "fa-telegram", linkedin: "fa-linkedin-in" };
    const NAME = { facebook: "Facebook", instagram: "Instagram", x: "X", youtube: "YouTube", whatsapp: "WhatsApp", telegram: "Telegram", linkedin: "LinkedIn", website: "Website" };
    window.AKDFA.get("/social").then(({ links }) => {
      if (!links || !links.length) return;
      socialBox.innerHTML = links.map((l) => {
        const icon = ICON[l.platform] ? `fa-brands ${ICON[l.platform]}` : "fa-solid fa-globe";
        const name = l.label || NAME[l.platform] || l.platform;
        return `<a class="social-icon" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(name)}" title="${esc(name)}"><i class="${icon}" aria-hidden="true"></i></a>`;
      }).join("");
      document.getElementById("homeSocial").hidden = false;
    }).catch(() => {});
  }
})();
