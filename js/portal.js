// Homepage: featured carousel, click-to-play video, and live news cards (static cards stay if the API is down).
(() => {
  const slidesEl = document.querySelector("[data-slides]");
  const dotsEl = document.querySelector("[data-dots]");
  if (slidesEl && dotsEl) {
    const slides = [...slidesEl.children];
    slides.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", `Go to slide ${i + 1}: ${s.dataset.title || ""}`);
      b.addEventListener("click", () => go(i));
      dotsEl.appendChild(b);
    });
    const dots = [...dotsEl.children];
    let index = 0;
    let timer = null;
    const go = (i) => {
      index = (i + slides.length) % slides.length;
      slidesEl.scrollTo({ left: slides[index].offsetLeft, behavior: "smooth" });
    };
    const mark = () => {
      const i = Math.round(slidesEl.scrollLeft / slidesEl.clientWidth);
      index = i;
      dots.forEach((d, k) => d.classList.toggle("is-active", k === i));
    };
    slidesEl.addEventListener("scroll", mark, { passive: true });
    document.querySelector("[data-prev]")?.addEventListener("click", () => go(index - 1));
    document.querySelector("[data-next]")?.addEventListener("click", () => go(index + 1));
    const play = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      stop();
      timer = setInterval(() => go(index + 1), 6000);
    };
    const stop = () => timer && clearInterval(timer);
    slidesEl.addEventListener("pointerenter", stop);
    slidesEl.addEventListener("pointerleave", play);
    mark();
    play();
  }

  // click-to-play: only loads YouTube when asked
  document.querySelectorAll("[data-video]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = document.createElement("iframe");
      f.src = `https://www.youtube.com/embed/${btn.dataset.video}?autoplay=1&rel=0&modestbranding=1`;
      f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      f.allowFullscreen = true;
      f.title = btn.getAttribute("aria-label") || "Video";
      btn.replaceChildren(f);
    });
  });

  // live news
  const list = document.getElementById("homeNews");
  const api = window.AKDFA;
  if (list && api) {
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1).toLowerCase();
    api.get("/news").then(({ posts }) => {
      if (!posts || !posts.length) return;
      list.innerHTML = posts.slice(0, 6).map((p) => `<a class="card" href="news.html">
        ${p.coverImageUrl ? `<img src="${esc(p.coverImageUrl)}" alt="" loading="lazy">` : ""}
        <span class="tag">${esc(cap(p.scope))}${p.district ? " · " + esc(p.district.name) : ""}</span>
        <h3>${esc(p.title)}</h3>
        <small>${esc(new Date(p.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }))}</small>
      </a>`).join("");
    }).catch(() => {});
  }
})();
