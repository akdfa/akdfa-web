const units = [
  "Alappuzha",
  "Ernakulam",
  "Idukki",
  "Kannur",
  "Kasaragod",
  "Kollam",
  "Kottayam",
  "Kozhikode",
  "Malappuram",
  "Palakkad",
  "Pathanamthitta",
  "Trivandrum",
  "Thrissur",
  "Wayanad",
  "Chennai",
  "Bangalore",
  "Ladies"
];

const committeeData = {
  Alappuzha: {
    title: "Alappuzha Unit Contacts",
    roles: [
      ["President", "AKASH : +91 90377 48560"],
      ["Contact", "JIBIN : +91 82816 16818"]
    ],
    tournaments: ["Backwater 6s Cricket Cup - August 2026", "Alappuzha Beach Football Meet - November 2026"],
    community: "Regular boat-clinic health camps for fishing communities along the backwaters.",
    standout: "A last-over run chase in the 2025 Backwater 6s final is still talked about at unit meets."
  },
  Ernakulam: {
    title: "Ernakulam Unit Contacts",
    roles: [
      ["President", "RENISH : +91 99461 10191"],
      ["Contact", "BINSON : +91 70255 93832"]
    ],
    tournaments: ["Ernakulam Corporate Box Cricket League - July 2026", "Kochi Fan Meet & Screening - September 2026"],
    community: "Coordinates the state's largest blood donation drives, drawing volunteers from every neighbouring unit.",
    standout: "A unit XI upset a touring corporate team in the 2025 Box Cricket League opener."
  },
  Idukki: {
    title: "Idukki Unit Contacts",
    roles: [
      ["President", "AKSHAY : +91 79079 84260"],
      ["Contact", "SREERAJ : +91 80862 12245"]
    ],
    tournaments: ["Hill Country T10 Challenge - October 2026"],
    community: "Distributes school supplies to estate-worker families ahead of the academic year.",
    standout: "A century partnership on a rain-shortened hill ground defined the 2025 T10 final."
  },
  Kannur: {
    title: "Kannur Unit Contacts",
    roles: [
      ["President", "SAYOOJ : +91 95620 55270"],
      ["Contact", "DIJIN : +91 77363 66019"]
    ],
    tournaments: ["Kannur District Committee Cup - 2026-2027 season"],
    community: "Student support drives providing books and supplies, run in partnership with local schools.",
    standout: "The 2026 committee cup opener drew one of the unit's largest match-day crowds yet."
  },
  Kasaragod: {
    title: "Kasaragod Unit Contacts",
    roles: [
      ["President", "ABHINAV : 88485 45694"],
      ["Contact", "DEVANAND : +91 70224 07770"]
    ],
    tournaments: ["Border Districts Friendly Cup - December 2026"],
    community: "Joint charity drives with neighbouring Mangalore fan groups across the state border.",
    standout: "A cross-border friendly against a Karnataka fan XI became an annual fixture."
  },
  Kollam: {
    title: "Kollam Unit Contacts",
    roles: [
      ["President", "RAVI : +91 99465 91833"],
      ["Contact", "AADHI : +91 99466 33293"]
    ],
    tournaments: ["Kollam Coastal Cricket Meet - August 2026"],
    community: "Coastal cleanup drives paired with youth cricket coaching camps.",
    standout: "A coastal-ground washout was rescued by a last-minute indoor-nets exhibition match."
  },
  Kottayam: {
    title: "Kottayam Unit Contacts",
    roles: [
      ["President", "FEBBY : +91 81119 09967"],
      ["Contact", "ABHIJITH : +91 90483 36175"]
    ],
    tournaments: ["Kottayam Inter-Unit Sixes - September 2026"],
    community: "Supports flood-relief kit distribution during the monsoon season.",
    standout: "The Inter-Unit Sixes has produced three straight last-ball finishes since 2024."
  },
  Kozhikode: {
    title: "Kozhikode Unit Contacts",
    roles: [
      ["President", "RAMKIRAN : 99611 25461"],
      ["Contact", "AKSHAY : 90374 49850"]
    ],
    tournaments: ["Kozhikode Beach T20 - July 2026"],
    community: "Runs one of the association's most active blood-donor coordination networks.",
    standout: "The 2025 Beach T20 final ended in a super over on the sand."
  },
  Malappuram: {
    title: "Malappuram Unit Contacts",
    roles: [
      ["President", "MARJAAN : 8592841869"],
      ["Contact", "AKHIL : 74068 06810"]
    ],
    tournaments: ["Malappuram Youth Cricket Camp - June 2026"],
    community: "Youth talent camps aimed at spotting and mentoring local cricketers.",
    standout: "A camp graduate went on to captain a district under-19 side within a year."
  },
  Palakkad: {
    title: "Palakkad Unit Contacts",
    roles: [
      ["President", "RATHEESH : 8086379115"],
      ["Contact", "KESHAV : 97907 61667"]
    ],
    tournaments: ["Palakkad Gap T15 Tournament - October 2026"],
    community: "Farmer-family support drives during harvest season.",
    standout: "A record chase in windy Palakkad-gap conditions headlined the 2025 T15."
  },
  Pathanamthitta: {
    title: "Pathanamthitta Unit Contacts",
    roles: [
      ["President", "ATHUL : 7559931705"],
      ["Contact", "AJI P JOSE : +966 55 747 4198"]
    ],
    tournaments: ["Pathanamthitta Pilgrim Season Cup - November 2026"],
    community: "Volunteer support during the pilgrim season alongside local authorities.",
    standout: "A unit team's unbeaten run through the 2025 Pilgrim Season Cup group stage."
  },
  Trivandrum: {
    title: "Trivandrum Unit Contacts",
    roles: [
      ["President", "PRITHVI : 7293497016"],
      ["Contact", "SANJAY : 95676 62914"]
    ],
    tournaments: ["Capital City Corporate Cup - August 2026"],
    community: "Organizes the state capital's largest AKDFA fan-meet and screening events.",
    standout: "A capacity fan-meet screening turnout made headlines in 2025."
  },
  Thrissur: {
    title: "Thrissur Unit Contacts",
    roles: [
      ["President", "ANANTHAKRISHNAN : 62386 26751"],
      ["Contact", "JISHNU : 98468 88301"]
    ],
    tournaments: ["AKDFA Thrissur 5s Football Tournament - June 2026"],
    community: "Runs recurring food-kit distribution drives across Thrissur neighbourhoods.",
    standout: "The 5s Football Tournament, themed around the FIFA World Cup 2026, is the unit's flagship event."
  },
  Wayanad: {
    title: "Wayanad Unit Contacts",
    roles: [
      ["President", "DOMNIC : 80752 01873"],
      ["Contact", "BASIL : 80750 44074"]
    ],
    tournaments: ["Wayanad Hill Cup - September 2026"],
    community: "Supports post-monsoon relief and rebuilding drives in vulnerable hill communities.",
    standout: "A monsoon-delayed Hill Cup final was completed under floodlights borrowed from a local ground."
  },
  Chennai: {
    title: "Chennai Unit Contacts",
    roles: [
      ["President", "Contact unit for current committee details"]
    ],
    tournaments: ["Chennai Malayali Premier League - 2026-2027 season"],
    community: "Connects the Kerala diaspora in Chennai through cricket meets and festival events.",
    standout: "The unit fields a mixed-diaspora XI that has become a fixture of the local Malayali league."
  },
  Bangalore: {
    title: "Bangalore Unit Contacts",
    roles: [
      ["President", "Contact unit for current committee details"]
    ],
    tournaments: ["Bangalore Weekend Box Cricket Series - ongoing through 2026"],
    community: "Regular blood donation and community meetups for the Kerala diaspora in Bangalore.",
    standout: "The weekend box cricket series regularly draws members from across the city's tech corridor."
  },
  Ladies: {
    title: "Ladies Unit Contact",
    roles: [
      ["Email", "akdfagirlswing7@gmail.com"]
    ],
    tournaments: ["AKDFA Ladies Friendly Cricket Meet - 2026"],
    community: "Leads women-focused outreach and charity initiatives across all 17 units.",
    standout: "The Ladies Friendly Cricket Meet was the unit's first standalone tournament."
  }
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pageLoader = document.querySelector(".page-loader");

const finishPageIntro = () => {
  document.body.classList.add("page-ready");
  if (!pageLoader) return;

  if (prefersReducedMotion) {
    pageLoader.remove();
    return;
  }

  window.setTimeout(() => {
    pageLoader.classList.add("is-hidden");
    window.setTimeout(() => pageLoader.remove(), 520);
  }, 650);
};

if (document.readyState === "complete") {
  finishPageIntro();
} else {
  window.addEventListener("load", finishPageIntro, { once: true });
}

const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector("[data-nav-links]");
const siteHeader = document.querySelector(".site-header");

const closeMobileMenu = () => {
  if (!navLinks || !menuToggle) return;
  navLinks.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
};

const syncHeaderState = () => {
  if (!siteHeader) return;
  siteHeader.classList.toggle("is-scrolled", window.scrollY > 18);
};

syncHeaderState();
window.addEventListener("scroll", syncHeaderState, { passive: true });

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("menu-open", isOpen);
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      closeMobileMenu();
    });
  });
}

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const href = anchor.getAttribute("href");
    if (!href || href === "#") return;
    const target = document.querySelector(href);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  });
});

const revealItems = document.querySelectorAll(".reveal");
revealItems.forEach((item, index) => {
  const isCard = item.matches(".glass-card, .activity-card, .gallery-tile, .unit-card, .trust-item, .principle-card");
  const isRight = item.matches(".hero-visual, .demo-form, .contact-info, .feature-card.reverse");
  const isLeft = item.matches(".section-heading, .section-copy, .feature-card");

  if (isCard) item.classList.add("reveal-scale");
  else if (isRight) item.classList.add("reveal-right");
  else if (isLeft) item.classList.add("reveal-left");

  item.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 70}ms`);
});

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.14 });

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const counters = document.querySelectorAll("[data-counter]");
if ("IntersectionObserver" in window) {
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const counter = entry.target;
      counter.closest(".glass-card")?.classList.add("stat-active");
      const target = Number(counter.dataset.counter || 0);
      const suffix = counter.dataset.suffix || "";
      const start = performance.now();
      const duration = 1200;

      const animate = (time) => {
        const progress = Math.min((time - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        counter.textContent = `${Math.round(target * eased).toLocaleString()}${suffix}`;
        if (progress < 1) requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
      counterObserver.unobserve(counter);
    });
  }, { threshold: 0.65 });

  counters.forEach((counter) => counterObserver.observe(counter));
}

const districtGrid = document.querySelector("#districtGrid");
if (districtGrid) {
  units.forEach((unit) => {
    const button = document.createElement("button");
    button.className = "unit-card district-unit reveal reveal-scale is-visible";
    button.type = "button";
    button.dataset.district = unit;
    button.textContent = unit;
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-label", `View ${unit} unit contacts`);
    districtGrid.append(button);
  });
}

const modal = document.querySelector("#committeeModal");
const modalTitle = document.querySelector("#committeeTitle");
const modalEyebrow = document.querySelector("#committeeEyebrow");
const modalContent = document.querySelector("#committeeContent");
const callNotice = document.querySelector("#callNotice");
let lastFocusedElement = null;

const getFocusableElements = (container) => Array.from(
  container.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')
);

const splitContactValue = (value) => {
  const parts = value.split(":");
  if (parts.length < 2) return { name: value.trim(), detail: "" };
  return {
    name: parts.shift().trim(),
    detail: parts.join(":").trim()
  };
};

const normalizePhoneNumber = (value) => {
  if (!value) return "";
  const hasPlus = value.trim().startsWith("+");
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
};

const createContactMarkup = ([role, value]) => {
  const { name, detail } = splitContactValue(value);
  const isEmail = role.toLowerCase() === "email" || detail.includes("@") || name.includes("@");
  const phone = isEmail ? "" : normalizePhoneNumber(detail || value);
  const detailMarkup = detail ? `<small>${detail}</small>` : "";
  const callMarkup = phone
    ? `<a class="call-btn" href="tel:${phone}" data-call-link aria-label="Call ${name}">Call</a>`
    : "";

  return `
    <div class="committee-role">
      <span>${role}</span>
      <strong>${name}</strong>
      ${detailMarkup}
      ${callMarkup}
    </div>
  `;
};

const openCommitteeModal = (district) => {
  if (!modal || !modalTitle || !modalContent || !modalEyebrow) return;
  lastFocusedElement = document.activeElement;
  const data = committeeData[district];
  modalEyebrow.textContent = "AKDFA Unit";
  modalTitle.textContent = data ? data.title : `${district} Unit`;
  if (callNotice) {
    callNotice.textContent = "";
    callNotice.classList.remove("is-visible");
  }

  if (!data) {
    modalContent.innerHTML = '<p class="empty-state">Unit contact details will be updated soon.</p>';
  } else {
    const roles = data.roles.map(createContactMarkup).join("");
    const tournamentsMarkup = data.tournaments?.length
      ? `
        <div class="district-profile-block">
          <h4><i class="fa-solid fa-trophy" aria-hidden="true"></i> Tournaments</h4>
          <ul class="district-profile-list">${data.tournaments.map((item) => `<li>${item}</li>`).join("")}</ul>
        </div>
      `
      : "";
    const communityMarkup = data.community
      ? `
        <div class="district-profile-block">
          <h4><i class="fa-solid fa-hand-holding-heart" aria-hidden="true"></i> Community Work</h4>
          <p>${data.community}</p>
        </div>
      `
      : "";
    const standoutMarkup = data.standout
      ? `
        <div class="district-profile-block">
          <h4><i class="fa-solid fa-star" aria-hidden="true"></i> Standout Match</h4>
          <p>${data.standout}</p>
        </div>
      `
      : "";

    modalContent.innerHTML = `
      <div class="district-profile">${tournamentsMarkup}${communityMarkup}${standoutMarkup}</div>
      <h4 class="committee-grid-title">Unit Contacts</h4>
      <div class="committee-grid">${roles}</div>
    `;
  }

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  window.requestAnimationFrame(() => {
    modal.querySelector(".modal-close")?.focus();
  });
};

const closeCommitteeModal = () => {
  if (!modal) return;
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus({ preventScroll: true });
  }
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  callNotice?.classList.remove("is-visible");
};

document.addEventListener("click", (event) => {
  if (
    navLinks?.classList.contains("is-open") &&
    !navLinks.contains(event.target) &&
    !menuToggle?.contains(event.target)
  ) {
    closeMobileMenu();
  }

  const callLink = event.target.closest("[data-call-link]");
  if (callLink) {
    window.setTimeout(() => {
      if (!document.hidden && callNotice) {
        callNotice.textContent = "If no calling option opens on this device, use a phone or another calling-enabled device to connect.";
        callNotice.classList.add("is-visible");
      }
    }, 900);
  }

  const unitCard = event.target.closest("[data-district]");
  if (unitCard) openCommitteeModal(unitCard.dataset.district);

  if (event.target.matches(".modal-close") || event.target === modal) {
    closeCommitteeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal?.classList.contains("is-open")) {
    closeCommitteeModal();
  }

  if (event.key === "Escape" && navLinks?.classList.contains("is-open")) {
    closeMobileMenu();
    menuToggle?.focus({ preventScroll: true });
  }

  if (event.key === "Tab" && modal?.classList.contains("is-open")) {
    const focusableElements = getFocusableElements(modal);
    if (!focusableElements.length) return;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth >= 1100) closeMobileMenu();
}, { passive: true });

const filterButtons = document.querySelectorAll(".filter-btn");
const galleryTiles = document.querySelectorAll(".gallery-tile");

filterButtons.forEach((button) => {
  button.setAttribute("aria-pressed", button.classList.contains("is-active") ? "true" : "false");

  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    filterButtons.forEach((item) => {
      item.classList.remove("is-active");
      item.setAttribute("aria-pressed", "false");
    });
    button.classList.add("is-active");
    button.setAttribute("aria-pressed", "true");

    galleryTiles.forEach((tile) => {
      const show = filter === "all" || tile.dataset.category === filter;
      if (show) {
        tile.classList.remove("is-gone");
        requestAnimationFrame(() => tile.classList.remove("is-hidden"));
      } else {
        tile.classList.add("is-hidden");
        window.setTimeout(() => tile.classList.add("is-gone"), prefersReducedMotion ? 0 : 260);
      }
    });
  });
});

const bindDemoForm = (formId, messageId, message) => {
  const form = document.querySelector(formId);
  const output = document.querySelector(messageId);
  if (!form || !output) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    output.textContent = message;
    output.classList.add("is-visible");
    form.reset();
  });
};

// Live form handlers (contact, sponsor lead, newsletter, join, login) are bound
// in js/public.js against the AKDFA API. bindDemoForm remains for any page that
// still needs a purely static acknowledgement.

const eventFilterButtons = document.querySelectorAll(".event-filter-btn");
const eventCards = document.querySelectorAll(".event-card");

eventFilterButtons.forEach((button) => {
  button.setAttribute("aria-pressed", button.classList.contains("is-active") ? "true" : "false");

  button.addEventListener("click", () => {
    const filter = button.dataset.eventFilter;
    eventFilterButtons.forEach((item) => {
      item.classList.remove("is-active");
      item.setAttribute("aria-pressed", "false");
    });
    button.classList.add("is-active");
    button.setAttribute("aria-pressed", "true");

    eventCards.forEach((card) => {
      const show = filter === "all" || card.dataset.eventDistrict === filter;
      card.classList.toggle("is-hidden", !show);
    });
  });
});

document.querySelectorAll(".demo-alert").forEach((button) => {
  button.addEventListener("click", () => {
    alert("Detailed page will be updated soon.");
  });
});
