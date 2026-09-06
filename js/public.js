/*
 * Wires the public AKDFA site to the live API:
 *   - contact / sponsor-lead / newsletter forms
 *   - membership registration (join.html)
 *   - member sign-in (login.html) -> redirects into the portal
 *   - swaps the "Sign In" nav link for "My AKDFA" when a session exists
 * Loads after script.js so it owns these specific forms.
 */
(function () {
  "use strict";
  const api = window.AKDFA;
  if (!api) return;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const setMsg = (el, text, ok) => {
    if (!el) return;
    el.textContent = text;
    el.classList.add("is-visible");
    el.classList.toggle("form-message--error", ok === false);
    el.classList.toggle("form-message--ok", ok === true);
  };
  const busy = (form, on) => {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = on;
      if (on) { btn.dataset.label = btn.textContent; btn.textContent = "Please wait…"; }
      else if (btn.dataset.label) btn.textContent = btn.dataset.label;
    }
  };
  const fields = (form) => {
    const out = {};
    new FormData(form).forEach((v, k) => { out[k] = typeof v === "string" ? v.trim() : v; });
    return out;
  };

  /* ---- nav session link -------------------------------------------------- */
  if (api.isLoggedIn()) {
    document.querySelectorAll('.nav-links a[href="login.html"], .footer-links a[href="login.html"]').forEach((a) => {
      a.textContent = "My AKDFA";
      a.href = "app.html";
      a.removeAttribute("aria-current");
    });
  }

  /* ---- contact form ---------------------------------------------------- */
  const contactForm = $("#contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("#contactMessage");
      const f = fields(contactForm);
      busy(contactForm, true);
      try {
        await api.publicPost("/public/contact", {
          name: f.name, email: f.email, phone: f.phone || undefined,
          subject: f.subject || undefined, message: f.message,
        });
        setMsg(msg, "Thanks — your message has reached the AKDFA team. We'll be in touch.", true);
        contactForm.reset();
      } catch (err) {
        setMsg(msg, err.status === 0
          ? "We couldn't reach the server. Please email info@akdfa.com directly."
          : (err.message || "Something went wrong."), false);
      } finally { busy(contactForm, false); }
    });
  }

  /* ---- sponsor lead form --------------------------------------------- */
  const sponsorForm = $("#sponsorForm");
  if (sponsorForm) {
    sponsorForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("#sponsorMessage");
      const f = fields(sponsorForm);
      busy(sponsorForm, true);
      try {
        await api.publicPost("/sponsors/leads", {
          name: f.organization || f.company || f.name,
          contactName: f.name || undefined,
          contactEmail: f.email,
          contactPhone: f.phone || undefined,
          message: [f.tier ? "Tier interest: " + f.tier : "", f.message || ""].filter(Boolean).join(" — ") || undefined,
        });
        setMsg(msg, "Thank you — the State Committee will follow up about sponsoring AKDFA.", true);
        sponsorForm.reset();
      } catch (err) {
        setMsg(msg, err.status === 0 ? "We couldn't reach the server. Please email info@akdfa.com." : err.message, false);
      } finally { busy(sponsorForm, false); }
    });
  }

  /* ---- newsletter form ---------------------------------------------- */
  const newsletterForm = $("#newsletterForm");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("#newsletterMessage");
      const f = fields(newsletterForm);
      busy(newsletterForm, true);
      try {
        await api.publicPost("/public/newsletter", { email: f.email });
        setMsg(msg, "You're subscribed. Watch your inbox for AKDFA updates.", true);
        newsletterForm.reset();
      } catch (err) {
        setMsg(msg, err.status === 0 ? "We couldn't reach the server just now." : err.message, false);
      } finally { busy(newsletterForm, false); }
    });
  }

  /* ---- registration (join.html) ----------------------------------- */
  const joinForm = $("#joinForm");
  const districtSel = joinForm && joinForm.querySelector('select[name="district"]');
  const unitSel = joinForm && joinForm.querySelector('select[name="unit"]');
  if (joinForm && districtSel && unitSel) {
    let districts = [];
    api.get("/districts").then(({ districts: d }) => {
      districts = d;
      districtSel.innerHTML = '<option value="" disabled selected>Select your district</option>' +
        d.map((x) => `<option value="${x.id}">${x.name}</option>`).join("");
    }).catch(() => {
      setMsg($("#joinMessage"), "Couldn't load districts — the membership server may be offline.", false);
    });

    districtSel.addEventListener("change", async () => {
      unitSel.innerHTML = '<option value="">Loading units…</option>';
      unitSel.disabled = true;
      try {
        const { units } = await api.get("/units?districtId=" + encodeURIComponent(districtSel.value));
        unitSel.innerHTML = units.length
          ? units.map((u) => `<option value="${u.id}">${u.name}</option>`).join("")
          : '<option value="">No units yet — contact your district</option>';
        unitSel.disabled = units.length === 0;
      } catch (err) {
        unitSel.innerHTML = '<option value="">Could not load units</option>';
      }
    });

    joinForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("#joinMessage");
      const f = fields(joinForm);
      if (!f.unit) return setMsg(msg, "Please pick your district and unit.", false);
      if (!f.password || f.password.length < 8) return setMsg(msg, "Choose a password of at least 8 characters.", false);
      busy(joinForm, true);
      try {
        const ref = new URLSearchParams(location.search).get("ref") || undefined;
        await api.register({
          unitId: f.unit, fullName: f.name, email: f.email, phone: f.phone,
          password: f.password, referrerId: ref,
        });
        setMsg(msg, "Membership requested! Your unit admin will approve you, then sign in at the member portal.", true);
        joinForm.reset();
        unitSel.innerHTML = '<option value="">Select your district first</option>';
        setTimeout(() => { location.href = "login.html"; }, 2500);
      } catch (err) {
        setMsg(msg, err.status === 409 ? "That email or phone is already registered. Try signing in." : (err.message || "Registration failed."), false);
      } finally { busy(joinForm, false); }
    });
  }

  /* ---- sign in (login.html) -------------------------------------- */
  const loginForm = $("#loginForm");
  if (loginForm) {
    if (api.isLoggedIn()) { location.replace("app.html"); return; }
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("#loginMessage");
      const f = fields(loginForm);
      busy(loginForm, true);
      try {
        await api.login(f.email, f.password);
        setMsg(msg, "Signed in — taking you to your AKDFA portal…", true);
        location.href = "app.html";
      } catch (err) {
        setMsg(msg, err.status === 401 ? "Wrong email or password." :
          err.status === 0 ? "Can't reach the server. Try again shortly." : (err.message || "Sign-in failed."), false);
      } finally { busy(loginForm, false); }
    });
  }
})();
