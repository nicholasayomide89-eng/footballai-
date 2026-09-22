// Minimal DOM helpers — enough structure to build views without a framework.

/**
 * el("div.card", { onclick }, [children]) — tag string supports #id and .class
 * shorthands, attrs handles events (on*), dataset, style objects and plain
 * attributes, children may be nodes, strings, numbers or nested arrays.
 */
export function el(spec, attrs = {}, children = []) {
  const [tagAndId, ...classes] = String(spec).split(".");
  const [tag, id] = tagAndId.split("#");
  const node = document.createElement(tag || "div");
  if (id) node.id = id;
  if (classes.length) node.classList.add(...classes);

  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2), value);
    } else if (key === "dataset") {
      Object.assign(node.dataset, value);
    } else if (key === "style" && typeof value === "object") {
      for (const [prop, val] of Object.entries(value)) {
        if (val === null || val === undefined) continue;
        // Custom properties are invisible to style.setAttribute-style writes.
        if (prop.startsWith("--")) node.style.setProperty(prop, String(val));
        else node.style[prop] = val;
      }
    } else if (key === "class") {
      node.classList.add(...String(value).split(/\s+/).filter(Boolean));
    } else if (key === "html") {
      node.innerHTML = value;
    } else if (value === true) {
      node.setAttribute(key, "");
    } else {
      node.setAttribute(key, value);
    }
  }

  append(node, children);
  return node;
}

export function append(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
  return parent;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(node, children) {
  clear(node);
  append(node, children);
  return node;
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/** Readable initials for the avatar chips ("Ada Okonkwo" -> "AO"). */
export function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

/** Pick black or white text depending on how light the background colour is. */
export function contrastText(hex) {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return "#fff";
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#10131a" : "#ffffff";
}

export function icon(name) {
  const paths = {
    left: "M15 18l-6-6 6-6",
    right: "M9 18l6-6-6-6",
    plus: "M12 5v14M5 12h14",
    calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
    users: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
    away: "M3 6h18M3 12h12M3 18h6M17 14l4 4-4 4",
    chart: "M3 3v18h18M7 15v3M12 9v9M17 5v13",
    settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-2.8 1.17V21a2 2 0 11-4 0v-.09A1.65 1.65 0 006.6 19.4l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 003 15H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9.4l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009.4 3H9a2 2 0 114 0v.09a1.65 1.65 0 002.8 1.17l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0021 9.6V9a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z",
    copy: "M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1",
    trash: "M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6",
    download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
    upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
    print: "M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z",
    check: "M20 6L9 17l-5-5",
    close: "M18 6L6 18M6 6l12 12",
    warn: "M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
    sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
    moon: "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
    search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35",
    clock: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2",
    send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", paths[name] || paths.calendar);
  svg.appendChild(path);
  return svg;
}

let toastTimer = null;
export function toast(message, tone = "info") {
  let host = $("#toast");
  if (!host) {
    host = el("div#toast", { class: "toast", role: "status", "aria-live": "polite" });
    document.body.appendChild(host);
  }
  host.textContent = message;
  host.dataset.tone = tone;
  host.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => host.classList.remove("is-visible"), 3200);
}

export function confirmDialog(message) {
  return window.confirm(message);
}
