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
    ]
  },
  Ernakulam: {
    title: "Ernakulam Unit Contacts",
    roles: [
      ["President", "RENISH : +91 99461 10191"],
      ["Contact", "BINSON : +91 70255 93832"]
    ]
  },
  Idukki: {
    title: "Idukki Unit Contacts",
    roles: [
      ["President", "AKSHAY : +91 79079 84260"],
      ["Contact", "SREERAJ : +91 80862 12245"]
    ]
  },
  Kannur: {
    title: "Kannur Unit Contacts",
    roles: [
      ["President", "SAYOOJ : +91 95620 55270"],
      ["Contact", "DIJIN : +91 77363 66019"]
    ]
  },
  Kasaragod: {
    title: "Kasaragod Unit Contacts",
    roles: [
      ["President", "ABHINAV : 88485 45694"],
      ["Contact", "DEVANAND : +91 70224 07770"]
    ]
  },
  Kollam: {
    title: "Kollam Unit Contacts",
    roles: [
      ["President", "RAVI : +91 99465 91833"],
      ["Contact", "AADHI : +91 99466 33293"]
    ]
  },
  Kottayam: {
    title: "Kottayam Unit Contacts",
    roles: [
      ["President", "FEBBY : +91 81119 09967"],
      ["Contact", "ABHIJITH : +91 90483 36175"]
    ]
  },
  Kozhikode: {
    title: "Kozhikode Unit Contacts",
    roles: [
      ["President", "RAMKIRAN : 99611 25461"],
      ["Contact", "AKSHAY : 90374 49850"]
    ]
  },
  Malappuram: {
    title: "Malappuram Unit Contacts",
    roles: [
      ["President", "MARJAAN : 8592841869"],
      ["Contact", "AKHIL : 74068 06810"]
    ]
  },
  Palakkad: {
    title: "Palakkad Unit Contacts",
    roles: [
      ["President", "RATHEESH : 8086379115"],
      ["Contact", "KESHAV : 97907 61667"]
    ]
  },
  Pathanamthitta: {
    title: "Pathanamthitta Unit Contacts",
    roles: [
      ["President", "ATHUL : 7559931705"],
      ["Contact", "AJI P JOSE : +966 55 747 4198"]
    ]
  },
  Trivandrum: {
    title: "Trivandrum Unit Contacts",
    roles: [
      ["President", "PRITHVI : 7293497016"],
      ["Contact", "SANJAY : 95676 62914"]
    ]
  },
  Thrissur: {
    title: "Thrissur Unit Contacts",
    roles: [
      ["President", "ANANTHAKRISHNAN : 62386 26751"],
      ["Contact", "JISHNU : 98468 88301"]
    ]
  },
  Wayanad: {
    title: "Wayanad Unit Contacts",
    roles: [
      ["President", "DOMNIC : 80752 01873"],
      ["Contact", "BASIL : 80750 44074"]
    ]
  },
  Ladies: {
    title: "Ladies Unit Contact",
    roles: [
      ["Email", "akdfagirlswing7@gmail.com"]
    ]
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
    modalContent.innerHTML = `
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

bindDemoForm("#contactForm", "#contactMessage", "Thank you for contacting AKDFA. Please use the official email or social links for direct follow-up.");

document.querySelectorAll(".demo-alert").forEach((button) => {
  button.addEventListener("click", () => {
    alert("Detailed page will be updated soon.");
  });
});
