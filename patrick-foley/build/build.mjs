// Générateur statique : `node build/build.mjs` écrit les pages HTML FR et EN.
// Aucune dépendance. Modifier SITE ci-dessous, puis relancer.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { services, extraService, beforeAfter, faq, t, privacy } from "./content.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const SITE = {
  // TODO : remplacer par le nom de domaine définitif (sans barre oblique finale).
  url: "https://www.example.com",
  name: "Patrick Foley – Révision linguistique et rédaction",
  person: "Patrick Foley",
  email: "communicationsecrites@gmail.com",
  phone: "514-775-1648",
  phoneIntl: "+15147751648",
  // Liens à fournir : ils s'afficheront automatiquement dans le pied de page.
  linkedin: "",
  facebook: "",
  // Chemin d'une photo (ex. "assets/patrick-foley.jpg"); vide = monogramme.
  portrait: "",
  // Point de réception du formulaire. "/" fonctionne tel quel sur Netlify (Netlify Forms).
  // Pour un autre hébergeur : URL Formspree, Basin, Getform, etc.
  formAction: "/",
  updated: "2026-09-27"
};

// Clé de page → chemin par langue
const PAGES = {
  home: { fr: "index.html", en: "en/index.html" },
  services: { fr: "services.html", en: "en/services.html" },
  about: { fr: "a-propos.html", en: "en/about.html" },
  contact: { fr: "contact.html", en: "en/contact.html" },
  privacy: { fr: "confidentialite.html", en: "en/privacy.html" },
  thanks: { fr: "merci.html", en: "en/thank-you.html" }
};

const other = (l) => (l === "fr" ? "en" : "fr");
const up = (l) => (l === "en" ? "../" : "");
const href = (key, from, to = from, hash = "") => {
  const p = PAGES[key][to];
  const rel = up(from) + (p.endsWith("index.html") ? p.replace("index.html", "") || "./" : p);
  return (rel === "" ? "./" : rel) + hash;
};
const abs = (key, l) => SITE.url + "/" + PAGES[key][l].replace(/index\.html$/, "");
const asset = (l, p) => up(l) + "assets/" + p;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const strip = (s) => s.replace(/<[^>]+>/g, "");

const icon = {
  arrow: `<span class="arrow" aria-hidden="true">→</span>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3.5 6l8.5 7 8.5-7"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`,
  check: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`
};

const brandMark = `<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><rect x=".5" y=".5" width="39" height="39" fill="none" stroke="currentColor" stroke-opacity=".35"/><text x="20" y="27" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="21" font-style="italic" fill="#7b2d32">pf</text></svg>`;

/* ---------------------------------------------------------------- head */
function head(l, key, extraLd = []) {
  const c = t[l];
  const pg = c.pages[key];
  const alt = other(l);
  const noindex = key === "thanks";
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      "@id": SITE.url + "/#business",
      name: SITE.name,
      alternateName: "Patrick Foley – Editing and Writing",
      description: t[l].pages.home.desc,
      url: abs("home", l),
      email: "mailto:" + SITE.email,
      telephone: "+1-514-775-1648",
      image: SITE.url + "/assets/og-image.png",
      logo: SITE.url + "/assets/icon-512.png",
      founder: { "@type": "Person", name: SITE.person, jobTitle: l === "fr" ? "Réviseur linguistique, traducteur et rédacteur" : "Linguistic editor, translator and writer" },
      address: { "@type": "PostalAddress", addressLocality: "Montréal", addressRegion: "QC", addressCountry: "CA" },
      areaServed: [{ "@type": "City", name: "Montréal" }, { "@type": "State", name: "Québec" }, { "@type": "Country", name: "Canada" }],
      knowsLanguage: ["fr-CA", "en-CA"],
      inLanguage: l === "fr" ? "fr-CA" : "en-CA",
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: l === "fr" ? "Services" : "Services",
        itemListElement: services[l].map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s.title, description: s.card } }))
      },
      ...(SITE.linkedin || SITE.facebook ? { sameAs: [SITE.linkedin, SITE.facebook].filter(Boolean) } : {})
    },
    ...extraLd
  ];
  return `<!doctype html>
<html lang="${l === "fr" ? "fr-CA" : "en-CA"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(pg.title)}</title>
<meta name="description" content="${esc(pg.desc)}">
${noindex ? `<meta name="robots" content="noindex">` : `<link rel="canonical" href="${abs(key, l)}">
<link rel="alternate" hreflang="${l === "fr" ? "fr-CA" : "en-CA"}" href="${abs(key, l)}">
<link rel="alternate" hreflang="${alt === "fr" ? "fr-CA" : "en-CA"}" href="${abs(key, alt)}">
<link rel="alternate" hreflang="x-default" href="${abs(key, "fr")}">`}
<meta name="theme-color" content="#faf7f0">
<meta name="author" content="${SITE.person}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:title" content="${esc(pg.title)}">
<meta property="og:description" content="${esc(pg.desc)}">
<meta property="og:url" content="${abs(key, l)}">
<meta property="og:locale" content="${c.locale}">
<meta property="og:locale:alternate" content="${t[alt].locale}">
<meta property="og:image" content="${SITE.url}/assets/og-image${l === "en" ? "-en" : ""}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(SITE.name)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${asset(l, "favicon.svg")}" type="image/svg+xml">
<link rel="icon" href="${up(l)}favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="${asset(l, "apple-touch-icon.png")}">
<link rel="manifest" href="${up(l)}site.webmanifest">
<link rel="preload" href="${asset(l, "fonts/fraunces.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${asset(l, "fonts/sourcesans3.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${asset(l, "styles.css")}">
<script defer src="${asset(l, "main.js")}"></script>
${noindex ? "" : `<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld)}</script>`}
</head>`;
}

/* ---------------------------------------------------------------- header */
function langSwitch(l, key, cls = "") {
  const c = t[l];
  const fr = l === "fr" ? `<span aria-current="true" lang="fr">FR</span>` : `<a href="${href(key, l, "fr")}" hreflang="fr" lang="fr" title="Version française">FR</a>`;
  const en = l === "en" ? `<span aria-current="true" lang="en">EN</span>` : `<a href="${href(key, l, "en")}" hreflang="en" lang="en" title="English version">EN</a>`;
  return `<nav class="lang-switch ${cls}" aria-label="${c.langLabel}">${fr}<span class="sep" aria-hidden="true">|</span>${en}</nav>`;
}

function header(l, key) {
  const c = t[l];
  const items = [
    ["home", c.nav.home, href("home", l)],
    ["services", c.nav.services, href("services", l)],
    ["about", c.nav.about, href("about", l)],
    ["method", c.nav.method, href("home", l, l, l === "fr" ? "#methode" : "#process")],
    ["faq", c.nav.faq, href("home", l, l, "#faq")],
    ["contact", c.nav.contact, href("contact", l)]
  ];
  return `<body>
<a class="skip-link" href="#main">${c.skip}</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="${href("home", l)}" aria-label="${esc(SITE.person)} – ${esc(c.nav.home)}">
      ${brandMark}
      <span><span class="brand-name">Patrick Foley</span><span class="brand-tag">${c.brandTag}</span></span>
    </a>
    <nav class="nav" id="site-nav" aria-label="${c.navLabel}">
      <ul class="nav-list">
        ${items.map(([k, label, h]) => `<li><a href="${h}"${k === key ? ` aria-current="page"` : ""}>${label}</a></li>`).join("\n        ")}
      </ul>
      <div class="nav-cta"><a class="btn" href="${href("contact", l)}">${c.ctaQuote} ${icon.arrow}</a></div>
    </nav>
    <div class="nav-tools">
      ${langSwitch(l, key)}
      <a class="btn btn--sm" href="${href("contact", l)}">${c.ctaQuote}</a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="bars" aria-hidden="true"><span></span><span></span><span></span></span><span class="menu-label">${c.menu}</span></button>
    </div>
  </div>
</header>`;
}

/* ---------------------------------------------------------------- footer */
function footer(l, key) {
  const c = t[l];
  const social = [
    SITE.linkedin && `<li><a href="${SITE.linkedin}" rel="me noopener" target="_blank">LinkedIn</a></li>`,
    SITE.facebook && `<li><a href="${SITE.facebook}" rel="me noopener" target="_blank">Facebook</a></li>`
  ].filter(Boolean).join("");
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="${href("home", l)}">${brandMark}<span class="brand-name">Patrick Foley</span></a>
        <p>${l === "fr" ? SITE.name : "Patrick Foley – Editing and writing"}</p>
        <p class="footer-services">${c.footer.services}</p>
        <p>${c.city}</p>
      </div>
      <div class="footer-col">
        <h2>${c.footer.nav}</h2>
        <ul>
          <li><a href="${href("services", l)}">${c.nav.services}</a></li>
          <li><a href="${href("about", l)}">${c.nav.about}</a></li>
          <li><a href="${href("home", l, l, "#faq")}">${c.nav.faq}</a></li>
          <li><a href="${href("contact", l)}">${c.ctaQuote}</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h2>${c.footer.contact}</h2>
        <ul>
          <li><a href="mailto:${SITE.email}">${SITE.email}</a></li>
          <li><a href="tel:${SITE.phoneIntl}">${SITE.phone}</a></li>
          ${social}
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p style="margin:0">© <span data-year>${SITE.updated.slice(0, 4)}</span> Patrick Foley. ${c.footer.rights} · <a href="${href("privacy", l)}">${c.footer.privacy}</a></p>
      ${langSwitch(l, key)}
    </div>
  </div>
</footer>
<div class="mobile-cta">
  <a class="btn" href="${href("contact", l)}">${c.ctaQuote}</a>
  <a class="btn btn--ghost" href="mailto:${SITE.email}" aria-label="${c.ctaEmail}">${c.ctaEmailShort}</a>
</div>
</body>
</html>
`;
}

/* ---------------------------------------------------------------- sections */
function hero(l) {
  const c = t[l], h = c.hero, m = c.ms;
  const [pre, post] = m.lines[1].split(m.strike);
  return `<section class="hero" aria-labelledby="hero-title">
  <div class="wrap hero-grid">
    <div>
      <p class="eyebrow">${h.eyebrow}</p>
      <h1 id="hero-title">${h.h1.map((x) => `<span class="line">${x}</span>`).join(" ")}</h1>
      <p class="hero-sub">${h.sub}</p>
      <p class="hero-text">${h.text}</p>
      <div class="btn-row">
        <a class="btn" href="${href("contact", l)}">${c.ctaQuote} ${icon.arrow}</a>
        <a class="btn btn--ghost" href="#services">${h.cta2}</a>
      </div>
      <div class="hero-meta">${h.meta.map((x) => `<span>${x}</span>`).join("")}</div>
    </div>
    <figure class="manuscript" aria-hidden="true">
      <div class="ms-back"></div>
      <div class="ms-sheet">
        <div class="ms-head"><span>${m.title}</span><span>p. 1</span></div>
        <p class="ms-title">${l === "fr" ? "Dire juste" : "Saying it right"}</p>
        <p class="ms-body">${m.lines[0]} ${pre}<span class="ms-edit"><s>${m.strike}</s><span class="ms-ins">${m.insert}</span></span>${post} ${m.lines[2]} ${m.lines[3].replace(/\.$/, "")}<span class="ms-circle">.</span></p>
        <div class="ms-lines"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <span class="ms-note">${m.note}</span>
      </div>
    </figure>
  </div>
</section>`;
}

function serviceCards(l, headingLevel = 2) {
  const c = t[l].servicesSection;
  return `<section class="section section--rule" id="services" aria-labelledby="services-title">
  <div class="wrap">
    <div class="split-head reveal">
      <div><p class="eyebrow">${c.eyebrow}</p><h${headingLevel} id="services-title">${c.h2}</h${headingLevel}></div>
      <p>${c.p}</p>
    </div>
    <div class="cards">
      ${services[l].map((s, i) => `<article class="card reveal">
        <span class="card-num">${String(i + 1).padStart(2, "0")}</span>
        <h3>${s.title}</h3>
        <p>${s.card}</p>
        <a class="link-arrow" href="${href("services", l, l, "#" + s.id)}">${t[l].learnMore}<span class="visually-hidden"> ${t[l].learnMoreAbout} ${s.title.toLowerCase()}</span> ${icon.arrow}</a>
      </article>`).join("\n      ")}
    </div>
  </div>
</section>`;
}

function value(l) {
  const v = t[l].value;
  return `<section class="section section--dark" aria-labelledby="value-title">
  <div class="wrap value-grid">
    <div class="value-copy reveal">
      <p class="eyebrow">${v.eyebrow}</p>
      <h2 id="value-title">${v.h2}</h2>
      ${v.p.map((p) => `<p>${p}</p>`).join("")}
    </div>
    <ul class="value-words reveal" aria-label="${l === "fr" ? "Ce qu’une révision professionnelle améliore" : "What professional editing improves"}">
      ${v.words.map((w, i) => `<li><small>${String(i + 1).padStart(2, "0")}</small>${w}</li>`).join("\n      ")}
    </ul>
  </div>
</section>`;
}

function portrait(l) {
  const alt = t[l].about.portraitAlt;
  return SITE.portrait
    ? `<figure class="portrait"><img src="${up(l)}${SITE.portrait}" alt="${alt}" width="800" height="1000" loading="lazy"></figure>`
    : `<figure class="portrait" role="img" aria-label="${l === "fr" ? "Monogramme de Patrick Foley" : "Patrick Foley monogram"}">
        <!-- Remplacer par une photo : définir SITE.portrait dans build/build.mjs -->
        <span class="portrait-mono" aria-hidden="true">P<span>f</span></span>
        <figcaption aria-hidden="true">Montréal</figcaption>
      </figure>`;
}

function about(l, { full = false } = {}) {
  const a = t[l].about;
  return `<section class="section section--tint" id="${l === "fr" ? "a-propos" : "about"}" aria-labelledby="about-title">
  <div class="wrap about-grid">
    <div class="about-sticky reveal">${portrait(l)}</div>
    <div class="about-copy reveal">
      <p class="eyebrow">${a.eyebrow}</p>
      <h2 id="about-title">${a.h2}</h2>
      <p class="lede">${a.lede}</p>
      ${a.p.map((p) => `<p>${p}</p>`).join("")}
      <h3 class="visually-hidden">${a.principlesTitle}</h3>
      <div class="principles">
        ${a.principles.map(([h, p], i) => `<div class="principle"><h3><span>${String(i + 1).padStart(2, "0")}</span>${h}</h3><p>${p}</p></div>`).join("\n        ")}
      </div>
      ${full ? "" : `<p style="margin-top:2rem"><a class="link-arrow" href="${href("about", l)}">${a.more} ${icon.arrow}</a></p>`}
    </div>
  </div>
</section>`;
}

function processSection(l) {
  const p = t[l].process;
  return `<section class="section" id="${l === "fr" ? "methode" : "process"}" aria-labelledby="process-title">
  <div class="wrap">
    <div class="split-head reveal">
      <div><p class="eyebrow">${p.eyebrow}</p><h2 id="process-title">${p.h2}</h2></div>
      <p>${p.p}</p>
    </div>
    <ol class="steps">
      ${p.steps.map(([h, d], i) => `<li class="step reveal"><span class="step-num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><h3><span class="visually-hidden">${i + 1}. </span>${h}</h3><p>${d}</p></li>`).join("\n      ")}
    </ol>
    <div class="process-cta reveal">
      <p>${p.aside}</p>
      <a class="link-arrow" href="${href("contact", l)}">${p.cta} ${icon.arrow}</a>
    </div>
  </div>
</section>`;
}

function audience(l) {
  const a = t[l].audience;
  return `<section class="section section--tint" aria-labelledby="audience-title">
  <div class="wrap audience-grid">
    <div class="reveal">
      <p class="eyebrow">${a.eyebrow}</p>
      <h2 id="audience-title">${a.h2}</h2>
      <p style="color:var(--ink-soft)">${a.p}</p>
      <ul class="audience-who">${a.who.map((w) => `<li>${w}</li>`).join("")}</ul>
    </div>
    <div class="reveal">
      <h3 style="font-family:var(--sans);font-size:.82rem;letter-spacing:.16em;text-transform:uppercase;font-weight:600;color:var(--accent);margin-bottom:1.4rem">${a.examplesLabel}</h3>
      <ul class="tags">${a.examples.map((x) => `<li>${x}</li>`).join("")}</ul>
      <p class="note">${a.note}</p>
    </div>
  </div>
</section>`;
}

function beforeAfterSection(l) {
  const b = t[l].ba, seg = beforeAfter[l].segments;
  const before = seg.filter(([k]) => k !== "+").map(([, s]) => s).join("");
  const after = seg.filter(([k]) => k !== "-").map(([, s]) => s).join("");
  const marked = seg.map(([k, s]) => (k === "=" ? s : k === "-" ? `<del>${s}</del>` : `<ins>${s}</ins>`)).join("");
  const wc = (s) => s.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
  return `<section class="section" id="exemple" aria-labelledby="ba-title">
  <div class="wrap">
    <div class="split-head reveal">
      <div><p class="eyebrow">${b.eyebrow}</p><h2 id="ba-title">${b.h2}</h2></div>
      <p>${b.p}</p>
    </div>
    <div class="ba reveal">
      <div class="ba-controls">
        <p class="ba-label" style="margin:0">${b.label}</p>
        <button class="toggle" type="button" aria-pressed="false" data-ba-toggle><span class="toggle-track" aria-hidden="true"></span>${b.toggle}</button>
      </div>
      <div class="ba-grid">
        <div class="ba-panel">
          <h3>${b.before} <span class="count">${wc(before)} ${b.words}</span></h3>
          <div class="ba-text" aria-live="polite">
            <p class="plain">${before}</p>
            <p class="marked">${marked}</p>
          </div>
          <div class="ba-legend" aria-hidden="true"><span><del>abc</del> ${b.legendDel}</span><span><ins>abc</ins> ${b.legendIns}</span></div>
        </div>
        <div class="ba-panel ba-panel--after">
          <h3>${b.after} <span class="count">${wc(after)} ${b.words}</span></h3>
          <div class="ba-text"><p>${after}</p></div>
          <p class="visually-hidden">${b.notesTitle}</p>
          <ul class="ba-notes">${beforeAfter[l].notes.map((n) => `<li>${n}</li>`).join("")}</ul>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

function faqSection(l) {
  const f = t[l].faq;
  return `<section class="section section--tint" id="faq" aria-labelledby="faq-title">
  <div class="wrap faq-grid">
    <div class="reveal">
      <p class="eyebrow">${f.eyebrow}</p>
      <h2 id="faq-title">${f.h2}</h2>
      <p style="color:var(--ink-soft)">${f.p} <a href="mailto:${SITE.email}">${f.link}</a>.</p>
    </div>
    <div class="faq-list reveal">
      ${faq[l].map(([q, a], i) => `<details class="faq-item"${i === 0 ? " open" : ""}>
        <summary><span>${q}</span><span class="faq-icon" aria-hidden="true"></span></summary>
        <div class="faq-answer">${a}</div>
      </details>`).join("\n      ")}
    </div>
  </div>
</section>`;
}

function field(id, label, control, { req = false, opt = "", hint = "", full = false } = {}) {
  return `<div class="field${full ? " field--full" : ""}">
            <label for="${id}">${label}${req ? ` <span aria-hidden="true">*</span>` : ""}${opt ? ` <span class="opt">${opt}</span>` : ""}</label>
            ${hint ? `<p class="hint" id="${id}-hint">${hint}</p>` : ""}
            ${control}
            <p class="field-error" id="${id}-err" aria-live="polite"></p>
          </div>`;
}

function quoteForm(l, idp) {
  const c = t[l].contact, f = c.f;
  const id = (x) => `${idp}-${x}`;
  const desc = (x, hint) => `aria-describedby="${hint ? id(x) + "-hint " : ""}${id(x)}-err"`;
  return `<div class="form-wrap">
      <form class="form" data-quote-form name="soumission" method="post" action="${SITE.formAction}" enctype="multipart/form-data"
            data-netlify="true" netlify-honeypot="website" data-email="${SITE.email}" novalidate>
        <input type="hidden" name="form-name" value="soumission">
        <input type="hidden" name="langue-site" value="${l}">
        <input type="hidden" name="_subject" value="${l === "fr" ? "Nouvelle demande de soumission" : "New quote request"}">
        <h3>${c.formTitle}</h3>
        <p class="form-intro">${c.formIntro}</p>
        <div class="form-status form-status--error" role="alert" tabindex="-1"></div>
        <div class="form-grid">
          ${field(id("name"), f.name, `<input id="${id("name")}" name="name" type="text" autocomplete="name" required ${desc("name")}>`, { req: true })}
          ${field(id("email"), f.email, `<input id="${id("email")}" name="email" type="email" autocomplete="email" inputmode="email" required ${desc("email")}>`, { req: true })}
          ${field(id("org"), f.org, `<input id="${id("org")}" name="organisation" type="text" autocomplete="organization" ${desc("org")}>`, { opt: f.optional, full: true })}
          ${field(id("service"), f.service, `<select id="${id("service")}" name="service" required ${desc("service")}><option value="">${f.servicePh}</option>${f.serviceOpts.map((o) => `<option>${o}</option>`).join("")}</select>`, { req: true })}
          ${field(id("lang"), f.lang, `<select id="${id("lang")}" name="language" required ${desc("lang")}><option value="">${f.langPh}</option>${f.langOpts.map((o) => `<option>${o}</option>`).join("")}</select>`, { req: true })}
          ${field(id("desc"), f.desc, `<textarea id="${id("desc")}" name="description" rows="5" required ${desc("desc", true)}></textarea>`, { req: true, hint: f.descHint, full: true })}
          ${field(id("deadline"), f.deadline, `<input id="${id("deadline")}" name="deadline" type="date" ${desc("deadline")}>`, { opt: f.optional })}
          <div class="field">
            <label for="${id("file")}">${f.file} <span class="opt">${f.optional}</span></label>
            <div class="file-drop">
              <input id="${id("file")}" name="document" type="file" accept=".pdf,.doc,.docx,.odt,.rtf,.txt,.pptx,.xlsx" aria-describedby="${id("file")}-hint ${id("file")}-err">
              <span class="file-btn" aria-hidden="true">${f.fileBtn}</span>
              <span class="file-name">${f.fileNone}</span>
              <button type="button" class="file-clear" hidden>${f.fileClear}</button>
            </div>
            <p class="hint" id="${id("file")}-hint">${f.fileHint}</p>
            <p class="field-error" id="${id("file")}-err" aria-live="polite"></p>
          </div>
          ${field(id("msg"), f.message, `<textarea id="${id("msg")}" name="message" rows="4" ${desc("msg", true)}></textarea>`, { opt: f.optional, hint: f.messageHint, full: true })}
          <div class="field field--full">
            <label class="check" for="${id("consent")}"><input id="${id("consent")}" name="consent" type="checkbox" value="oui" required aria-describedby="${id("consent")}-err"><span>${f.consent} <a href="${href("privacy", l)}">${f.privacy}</a>. <span aria-hidden="true">*</span></span></label>
            <p class="field-error" id="${id("consent")}-err" aria-live="polite"></p>
          </div>
          <div class="hp" aria-hidden="true"><label for="${id("website")}">${f.hp}</label><input id="${id("website")}" name="website" type="text" tabindex="-1" autocomplete="off"></div>
        </div>
        <div class="form-footer">
          <small>${f.reassure}</small>
          <button class="btn" type="submit"><span class="spinner" aria-hidden="true"></span>${f.submit} ${icon.arrow}</button>
        </div>
      </form>
      <template id="form-success">
        <div class="form form-success" role="status">
          <div class="mark">${icon.check}</div>
          <h3>${c.success.h}</h3>
          <p>${c.success.p}</p>
          <p><a class="link-arrow" href="${href("home", l)}">${c.success.again} ${icon.arrow}</a></p>
        </div>
      </template>
    </div>`;
}

function contactSection(l, idp = "q", headingTag = "h2") {
  const c = t[l].contact;
  return `<section class="section contact" id="contact" aria-labelledby="contact-title">
  <div class="wrap contact-grid">
    <div class="contact-intro reveal">
      <p class="eyebrow" style="color:#e2b7b1">${c.eyebrow}</p>
      <${headingTag} id="contact-title">${c.h2}</${headingTag}>
      <p>${c.p}</p>
      <div class="contact-card">
        <p class="name">${l === "fr" ? SITE.name : "Patrick Foley – Editing and writing"}</p>
        <p class="place">${t[l].city}</p>
        <ul class="contact-lines">
          <li><a href="mailto:${SITE.email}">${icon.mail}<span><span class="visually-hidden">${c.email} : </span>${SITE.email}</span></a></li>
          <li><a href="tel:${SITE.phoneIntl}">${icon.phone}<span><span class="visually-hidden">${c.phone} : </span>${SITE.phone}</span></a></li>
        </ul>
        <p style="margin-top:1.6rem"><a class="btn btn--light" href="mailto:${SITE.email}">${t[l].ctaEmail}</a></p>
      </div>
    </div>
    <div class="reveal">${quoteForm(l, idp)}</div>
  </div>
</section>`;
}

function ctaBand(l, h, p) {
  const c = t[l];
  return `<section class="cta-band" aria-label="${c.ctaDiscuss}">
  <div class="wrap cta-band-inner">
    <div><h2>${h}</h2>${p ? `<p style="color:var(--ink-soft);margin:0">${p}</p>` : ""}</div>
    <div class="btn-row">
      <a class="btn" href="${href("contact", l)}">${c.ctaDiscuss} ${icon.arrow}</a>
      <a class="btn btn--ghost" href="mailto:${SITE.email}">${c.ctaEmail}</a>
    </div>
  </div>
</section>`;
}

function pageHero(l, key, h1, lede) {
  const c = t[l];
  return `<section class="page-hero">
  <div class="wrap">
    <nav class="breadcrumb" aria-label="${l === "fr" ? "Fil d’Ariane" : "Breadcrumb"}"><ol><li><a href="${href("home", l)}">${c.breadcrumbHome}</a></li><li aria-current="page">${c.nav[key] || h1}</li></ol></nav>
    <h1>${h1}</h1>
    ${lede ? `<p class="lede">${lede}</p>` : ""}
  </div>
</section>`;
}

function breadcrumbLd(l, key) {
  const c = t[l];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: c.breadcrumbHome, item: abs("home", l) },
      { "@type": "ListItem", position: 2, name: c.nav[key], item: abs(key, l) }
    ]
  };
}

/* ---------------------------------------------------------------- pages */
function homePage(l) {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq[l].map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: strip(a) } }))
  };
  return head(l, "home", [faqLd]) + header(l, "home") + `
<main id="main">
${hero(l)}
${serviceCards(l)}
${value(l)}
${about(l)}
${processSection(l)}
${audience(l)}
${beforeAfterSection(l)}
${faqSection(l)}
${contactSection(l)}
</main>
` + footer(l, "home");
}

function servicesPage(l) {
  const p = t[l].pages.services;
  const all = [...services[l], extraService[l]];
  const serviceLd = all.map((s) => ({
    "@context": "https://schema.org", "@type": "Service", name: s.title, description: s.summary,
    serviceType: s.title, provider: { "@id": SITE.url + "/#business" },
    areaServed: { "@type": "City", name: "Montréal" }, availableLanguage: ["fr", "en"]
  }));
  return head(l, "services", [breadcrumbLd(l, "services"), ...serviceLd]) + header(l, "services") + `
<main id="main">
${pageHero(l, "services", p.h1, p.lede)}
<nav class="svc-toc" aria-label="${p.tocLabel}"><div class="wrap"><ul>${all.map((s) => `<li><a href="#${s.id}">${s.title}</a></li>`).join("")}</ul></div></nav>
<div class="wrap">
${all.map((s, i) => `<section class="svc-detail reveal" id="${s.id}" aria-labelledby="${s.id}-t">
  <div>
    <span class="card-num">${String(i + 1).padStart(2, "0")}</span>
    <h2 id="${s.id}-t">${s.title}</h2>
    <p class="svc-summary">${s.summary}</p>
  </div>
  <div class="svc-body">
    ${s.body.map((b) => `<p>${b}</p>`).join("\n    ")}
    <h3>${p.includes}</h3>
    <ul class="svc-list">${s.includes.map((x) => `<li>${x}</li>`).join("")}</ul>
    <p><strong>${p.forWho}${l === "fr" ? " :" : ":"}</strong> ${s.ideal}</p>
    <a class="link-arrow" href="${href("contact", l)}">${t[l].ctaQuote} ${icon.arrow}</a>
  </div>
</section>`).join("\n")}
</div>
${processSection(l)}
${ctaBand(l, p.bandH, p.bandP)}
</main>
` + footer(l, "services");
}

function aboutPage(l) {
  const p = t[l].pages.about;
  return head(l, "about", [breadcrumbLd(l, "about")]) + header(l, "about") + `
<main id="main">
${pageHero(l, "about", p.h1, p.lede)}
${about(l, { full: true })}
<section class="section">
  <div class="wrap">
    <blockquote class="pull-quote reveal"><p style="margin:0">${p.quote}</p></blockquote>
    <div class="cards" style="margin-top:clamp(3rem,6vw,5rem)">
      ${p.sections.map(([h, b], i) => `<article class="card reveal"><span class="card-num">${String(i + 1).padStart(2, "0")}</span><h2 style="font-size:1.6rem">${h}</h2><p>${b}</p></article>`).join("\n      ")}
    </div>
  </div>
</section>
${value(l)}
${ctaBand(l, t[l].process.aside, "")}
</main>
` + footer(l, "about");
}

function contactPage(l) {
  const p = t[l].pages.contact;
  return head(l, "contact", [breadcrumbLd(l, "contact")]) + header(l, "contact") + `
<main id="main">
${pageHero(l, "contact", p.h1, p.lede)}
${contactSection(l, "c")}
${faqSection(l)}
</main>
` + footer(l, "contact");
}

function privacyPage(l) {
  const p = t[l].pages.privacy;
  const body = privacy[l].replaceAll("{{EMAIL}}", SITE.email).replaceAll("{{DATE}}", l === "fr" ? "27 septembre 2026" : "September 27, 2026");
  return head(l, "privacy") + header(l, "privacy") + `
<main id="main">
${pageHero(l, "privacy", p.h1, "")}
<section class="section" style="padding-top:clamp(2.5rem,5vw,4rem)"><div class="wrap"><div class="prose">${body}</div></div></section>
</main>
` + footer(l, "privacy");
}

function thanksPage(l) {
  const c = t[l];
  return head(l, "thanks") + header(l, "thanks") + `
<main id="main">
<section class="page-hero" style="border:0">
  <div class="wrap narrow">
    <div class="form-success">
      <div class="mark">${icon.check}</div>
      <h1 style="font-size:clamp(2.2rem,5vw,3.6rem)">${c.pages.thanks.h1}</h1>
      <p class="lede">${c.contact.success.p}</p>
      <p><a class="btn" href="${href("home", l)}">${c.contact.success.again} ${icon.arrow}</a></p>
    </div>
  </div>
</section>
</main>
` + footer(l, "thanks");
}

/* ---------------------------------------------------------------- write */
const builders = { home: homePage, services: servicesPage, about: aboutPage, contact: contactPage, privacy: privacyPage, thanks: thanksPage };
for (const [key, fn] of Object.entries(builders)) {
  for (const l of ["fr", "en"]) {
    const out = join(ROOT, PAGES[key][l]);
    mkdirSync(dirname(out), { recursive: true });
    // Page de remerciement utilisée par l'envoi sans JavaScript (Netlify)
    let html = fn(l);
    // Typographie française : espaces insécables devant le deux-points et dans les guillemets
    if (l === "fr") html = html.replace(/ ([:»])/g, "\u00a0$1").replace(/« /g, "«\u00a0");
    if (key !== "thanks") html = html.replace(`action="${SITE.formAction}"`, `action="${SITE.formAction === "/" ? "/" + PAGES.thanks[l] : SITE.formAction}"`);
    writeFileSync(out, html);
  }
}

const indexable = Object.keys(PAGES).filter((k) => k !== "thanks");
writeFileSync(join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${indexable.flatMap((k) => ["fr", "en"].map((l) => `  <url>
    <loc>${abs(k, l)}</loc>
    <lastmod>${SITE.updated}</lastmod>
    <xhtml:link rel="alternate" hreflang="fr-CA" href="${abs(k, "fr")}"/>
    <xhtml:link rel="alternate" hreflang="en-CA" href="${abs(k, "en")}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(k, "fr")}"/>
  </url>`)).join("\n")}
</urlset>
`);
writeFileSync(join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /merci.html\nDisallow: /en/thank-you.html\n\nSitemap: ${SITE.url}/sitemap.xml\n`);
writeFileSync(join(ROOT, "site.webmanifest"), JSON.stringify({
  name: SITE.name, short_name: "Patrick Foley", lang: "fr-CA", start_url: "./",
  display: "browser", background_color: "#faf7f0", theme_color: "#faf7f0",
  icons: [{ src: "assets/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "assets/icon-512.png", sizes: "512x512", type: "image/png" }]
}, null, 2) + "\n");

console.log("Pages générées dans", ROOT);
