// Light/dark theme: saved choice wins, otherwise the OS setting. Runs in <head> so the page never flashes the wrong theme.
(function () {
  var KEY = "akdfa-theme";
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  var current = function () { return saved || (mq && mq.matches ? "light" : "dark"); };
  var apply = function () {
    root.setAttribute("data-theme", current());
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", current() === "light" ? "#ffffff" : "#0c0c0d");
    var b = document.querySelector(".theme-toggle");
    if (b) {
      var light = current() === "light";
      b.innerHTML = light ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
      b.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
      b.title = b.getAttribute("aria-label");
    }
  };
  apply();
  if (mq && mq.addEventListener) mq.addEventListener("change", function () { if (!saved) apply(); });

  document.addEventListener("DOMContentLoaded", function () {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "theme-toggle";
    b.addEventListener("click", function () {
      saved = current() === "light" ? "dark" : "light";
      try { localStorage.setItem(KEY, saved); } catch (e) {}
      apply();
    });
    var nav = document.querySelector(".navbar");
    var toggle = nav && nav.querySelector(".menu-toggle");
    var bar = document.querySelector(".portal-topbar");
    if (bar) bar.insertBefore(b, bar.querySelector(".portal-bell"));
    else if (nav) nav.insertBefore(b, toggle || null);
    else { b.classList.add("theme-toggle-float"); document.body.appendChild(b); }
    apply();
  });
})();
