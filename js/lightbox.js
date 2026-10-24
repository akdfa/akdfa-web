// Photo viewer: click a gallery photo to see it large; arrow keys and Esc work too.
// Works on tiles added after the page loads (the gallery is built from the API).
(function () {
  const tiles = () => [...document.querySelectorAll(".gallery-tile")].filter((t) => t.querySelector("img") && !t.hidden);
  let box, img, cap, index = 0, list = [];

  function build() {
    box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Photo viewer");
    box.hidden = true;
    box.innerHTML =
      '<button type="button" class="lb-btn lb-close" aria-label="Close">&times;</button>' +
      '<button type="button" class="lb-btn lb-prev" aria-label="Previous photo">&#8249;</button>' +
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="lb-btn lb-next" aria-label="Next photo">&#8250;</button>';
    document.body.appendChild(box);
    img = box.querySelector("img");
    cap = box.querySelector("figcaption");
    box.addEventListener("click", (e) => {
      if (e.target === box || e.target.closest(".lb-close")) close();
      else if (e.target.closest(".lb-prev")) show(index - 1);
      else if (e.target.closest(".lb-next")) show(index + 1);
    });
    document.addEventListener("keydown", (e) => {
      if (box.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") show(index - 1);
      else if (e.key === "ArrowRight") show(index + 1);
    });
  }
  function show(i) {
    if (!list.length) return;
    index = (i + list.length) % list.length;
    const t = list[index], src = t.querySelector("img");
    img.src = src.currentSrc || src.src;
    img.alt = src.alt || "";
    cap.textContent = (t.querySelector("span") || {}).textContent || src.alt || "";
  }
  function open(tile) {
    if (!box) build();
    list = tiles();
    box.hidden = false;
    document.body.style.overflow = "hidden";
    show(Math.max(0, list.indexOf(tile)));
    box.querySelector(".lb-close").focus();
  }
  function close() { box.hidden = true; document.body.style.overflow = ""; }

  document.addEventListener("click", (e) => {
    const tile = e.target.closest(".gallery-tile");
    if (tile && tile.querySelector("img") && !e.target.closest("a")) open(tile);
  });
})();
