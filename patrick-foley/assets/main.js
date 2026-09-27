/* Patrick Foley – interactions (aucune dépendance) */
(function () {
  "use strict";

  var doc = document.documentElement;
  doc.classList.add("js");
  var lang = (doc.getAttribute("lang") || "fr").slice(0, 2);
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var T = {
    fr: {
      menu: "Menu", close: "Fermer",
      required: "Ce champ est requis.",
      email: "Veuillez entrer une adresse courriel valide (ex. nom@domaine.com).",
      select: "Veuillez faire un choix.",
      desc: "Quelques mots de plus nous aideraient : décrivez le projet en au moins 20 caractères.",
      consent: "Veuillez accepter que vos renseignements soient utilisés pour répondre à votre demande.",
      fileSize: "Le fichier dépasse 10 Mo. Envoyez-le plutôt par courriel après votre demande.",
      fileType: "Format non pris en charge. Formats acceptés : PDF, DOC, DOCX, ODT, RTF, TXT, PPTX, XLSX.",
      summary: "Le formulaire contient des éléments à corriger :",
      tooFast: "Votre demande a été soumise très rapidement. Veuillez patienter quelques secondes et réessayer.",
      network: "Votre demande n’a pas pu être envoyée pour le moment. Vous pouvez réessayer ou écrire directement à ",
      noFile: "Aucun fichier sélectionné",
      date: "La date souhaitée ne peut pas être dans le passé."
    },
    en: {
      menu: "Menu", close: "Close",
      required: "This field is required.",
      email: "Please enter a valid email address (e.g. name@domain.com).",
      select: "Please make a selection.",
      desc: "A few more words would help: please describe the project in at least 20 characters.",
      consent: "Please agree to the use of your information to respond to your request.",
      fileSize: "This file is larger than 10 MB. Please send it by email after submitting your request.",
      fileType: "Unsupported format. Accepted formats: PDF, DOC, DOCX, ODT, RTF, TXT, PPTX, XLSX.",
      summary: "Please review the following:",
      tooFast: "Your request was submitted very quickly. Please wait a few seconds and try again.",
      network: "Your request could not be sent right now. Please try again or write directly to ",
      noFile: "No file selected",
      date: "The requested date cannot be in the past."
    }
  }[lang === "en" ? "en" : "fr"];

  /* ---------- Header state ---------- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.querySelector(".menu-label").textContent = open ? T.close : T.menu;
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
    if (open) {
      var first = nav.querySelector("a");
      if (first) first.focus();
    }
  }
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        toggle.focus();
      }
    });
    window.matchMedia("(min-width: 941px)").addEventListener("change", function (m) {
      if (m.matches) setMenu(false);
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("is-visible");
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Before / after toggle ---------- */
  document.querySelectorAll("[data-ba-toggle]").forEach(function (btn) {
    var box = btn.closest(".ba");
    btn.addEventListener("click", function () {
      var on = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", String(on));
      box.classList.toggle("show-marks", on);
    });
  });

  /* ---------- Services sub-nav highlight ---------- */
  var tocLinks = document.querySelectorAll(".svc-toc a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var tio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          tocLinks.forEach(function (a) { a.classList.remove("is-active"); });
          map[en.target.id].classList.add("is-active");
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(map).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) tio.observe(s);
    });
  }

  /* ---------- Mobile CTA: hide when the form is on screen ---------- */
  var mcta = document.querySelector(".mobile-cta");
  var contactEl = document.getElementById("contact");
  var contactVisible = false;
  function updateCta() {
    if (mcta) mcta.classList.toggle("is-hidden", contactVisible || window.scrollY < 420);
  }
  if (mcta) {
    window.addEventListener("scroll", updateCta, { passive: true });
    updateCta();
  }
  if (mcta && contactEl && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      contactVisible = entries[0].isIntersecting;
      updateCta();
    }, { threshold: 0.05 }).observe(contactEl);
  }

  /* ---------- Soft page transition for internal links ---------- */
  if (!reduceMotion) {
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      if (!/\.html$|\/$/.test(url.pathname)) return;
      e.preventDefault();
      document.body.classList.add("is-leaving");
      setTimeout(function () { location.href = a.href; }, 180);
    });
    window.addEventListener("pageshow", function () { document.body.classList.remove("is-leaving"); });
  }

  /* ---------- Year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Quote form ---------- */
  var form = document.querySelector("form[data-quote-form]");
  if (!form) return;

  var startedAt = Date.now();
  var status = form.querySelector(".form-status");
  var submitBtn = form.querySelector("[type=submit]");
  var fileInput = form.querySelector("input[type=file]");
  var fileName = form.querySelector(".file-name");
  var fileClear = form.querySelector(".file-clear");
  var drop = form.querySelector(".file-drop");
  var MAX = 10 * 1024 * 1024;
  var EXT = /\.(pdf|docx?|odt|rtf|txt|pptx|xlsx)$/i;
  var CONTACT = form.getAttribute("data-email");

  var dateInput = form.querySelector("input[type=date]");
  if (dateInput) {
    var d = new Date();
    dateInput.min = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function fieldOf(el) { return el.closest(".field"); }
  function setError(el, msg) {
    var f = fieldOf(el);
    if (!f) return;
    var out = f.querySelector(".field-error");
    if (msg) {
      f.classList.add("has-error");
      el.setAttribute("aria-invalid", "true");
      if (out) out.textContent = msg;
    } else {
      f.classList.remove("has-error");
      el.removeAttribute("aria-invalid");
      if (out) out.textContent = "";
    }
  }

  function validate(el) {
    var v = (el.value || "").trim();
    var msg = "";
    if (el.type === "checkbox") {
      if (el.required && !el.checked) msg = T.consent;
    } else if (el.type === "file") {
      var file = el.files && el.files[0];
      if (file) {
        if (file.size > MAX) msg = T.fileSize;
        else if (!EXT.test(file.name)) msg = T.fileType;
      }
    } else if (el.required && !v) {
      msg = el.tagName === "SELECT" ? T.select : T.required;
    } else if (el.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      msg = T.email;
    } else if (el.name === "description" && v && v.length < 20) {
      msg = T.desc;
    } else if (el.type === "date" && v && el.min && v < el.min) {
      msg = T.date;
    }
    setError(el, msg);
    return msg;
  }

  var fields = form.querySelectorAll("input:not([type=hidden]), select, textarea");
  fields.forEach(function (el) {
    if (el.closest(".hp")) return;
    el.addEventListener("blur", function () { if (el.value || fieldOf(el) && fieldOf(el).classList.contains("has-error")) validate(el); });
    el.addEventListener("input", function () { if (fieldOf(el) && fieldOf(el).classList.contains("has-error")) validate(el); });
    el.addEventListener("change", function () { if (el.type === "checkbox" || el.tagName === "SELECT") validate(el); });
  });

  function showFile() {
    var f = fileInput.files && fileInput.files[0];
    fileName.textContent = f ? f.name + " (" + (f.size / 1024 / 1024).toFixed(1) + " Mo)".replace("Mo", lang === "en" ? "MB" : "Mo") : T.noFile;
    fileClear.hidden = !f;
    validate(fileInput);
  }
  if (fileInput) {
    fileInput.addEventListener("change", showFile);
    fileClear.addEventListener("click", function () { fileInput.value = ""; showFile(); fileInput.focus(); });
    ["dragenter", "dragover"].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.add("is-drag"); }); });
    ["dragleave", "drop"].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.remove("is-drag"); }); });
  }

  function showStatus(html) {
    status.innerHTML = html;
    status.classList.add("is-visible");
    status.focus();
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    status.classList.remove("is-visible");

    // Anti-spam: honeypot silently "succeeds"; too-fast submissions are asked to retry.
    var hp = form.querySelector(".hp input");
    if (hp && hp.value) { done(); return; }
    if (Date.now() - startedAt < 3000) { showStatus(esc(T.tooFast)); return; }

    var errors = [];
    fields.forEach(function (el) {
      if (el.closest(".hp")) return;
      var m = validate(el);
      if (m) {
        var lab = form.querySelector('label[for="' + el.id + '"]');
        var name = el.type === "checkbox" ? (lang === "en" ? "Consent" : "Consentement") : (lab ? lab.firstChild.textContent.trim() : el.name);
        errors.push({ el: el, label: name, msg: m });
      }
    });
    if (errors.length) {
      showStatus("<strong>" + esc(T.summary) + "</strong><ul>" + errors.map(function (er) {
        return '<li><a href="#' + er.el.id + '">' + esc(er.label) + "</a> — " + esc(er.msg) + "</li>";
      }).join("") + "</ul>");
      return;
    }

    var data = new FormData(form);
    data.set("elapsed", String(Math.round((Date.now() - startedAt) / 1000)));
    form.classList.add("is-sending");
    submitBtn.disabled = true;

    fetch(form.getAttribute("action"), { method: "POST", body: data, headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        done();
      })
      .catch(function () {
        var subject = encodeURIComponent((lang === "en" ? "Quote request – " : "Demande de soumission – ") + (data.get("name") || ""));
        var body = encodeURIComponent(
          [["name", data.get("name")], ["email", data.get("email")], ["organisation", data.get("organisation")],
           ["service", data.get("service")], ["language", data.get("language")], ["deadline", data.get("deadline")],
           ["description", data.get("description")], ["message", data.get("message")]]
            .filter(function (p) { return p[1]; }).map(function (p) { return p[0] + ": " + p[1]; }).join("\n\n"));
        showStatus(esc(T.network) + '<a href="mailto:' + CONTACT + "?subject=" + subject + "&body=" + body + '">' + CONTACT + "</a>.");
      })
      .then(function () {
        form.classList.remove("is-sending");
        submitBtn.disabled = false;
      });
  });

  function done() {
    var tpl = document.getElementById("form-success");
    var wrap = form.parentNode;
    wrap.innerHTML = tpl.innerHTML;
    var h = wrap.querySelector("h3");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
  }
})();
