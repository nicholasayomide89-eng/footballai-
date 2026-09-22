// Dialog shell plus the four editors: shift, employee, time off, settings.

import { el, mount, icon, toast, confirmDialog, initials, contrastText } from "./dom.js";
import {
  getState, upsertShift, removeShift, duplicateShift, upsertEmployee, removeEmployee,
  upsertTimeOff, removeTimeOff, setSettings, replaceAll, resetToDemo, clearEverything,
  exportJSON, PALETTE, ROLE_PRESETS,
} from "./store.js";
import {
  DAY_NAMES, DAY_SHORT, detectConflicts, parseTime, shiftHours, formatHours,
  todayISO, addDays, CONFLICT_TYPES,
} from "./scheduling.js";

let activeClose = null;

/** Opens a focus-trapped dialog. Returns a close() the caller can hold on to. */
export function openModal({ title, subtitle, body, footer, size = "md" }) {
  closeModal();
  const previousFocus = document.activeElement;

  const panel = el("div", { class: `modal modal--${size}`, role: "dialog", "aria-modal": "true", "aria-label": title }, [
    el("header.modal__head", {}, [
      el("div", {}, [el("h2.modal__title", {}, title), subtitle ? el("p.modal__sub", {}, subtitle) : null]),
      el("button.icon-btn", { type: "button", "aria-label": "Close dialog", onclick: () => closeModal() }, icon("close")),
    ]),
    el("div.modal__body", {}, body),
    footer ? el("footer.modal__foot", {}, footer) : null,
  ]);

  const overlay = el("div.overlay", {
    onclick: (event) => {
      if (event.target === overlay) closeModal();
    },
  }, panel);

  const onKey = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
    } else if (event.key === "Tab") {
      const focusable = panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
  document.body.classList.add("is-locked");
  requestAnimationFrame(() => {
    overlay.classList.add("is-open");
    const target = panel.querySelector("[data-autofocus]") || panel.querySelector("input, select, textarea, button");
    if (target) target.focus();
  });

  activeClose = () => {
    document.removeEventListener("keydown", onKey);
    overlay.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    setTimeout(() => overlay.remove(), 140);
    if (previousFocus && previousFocus.focus) previousFocus.focus();
    activeClose = null;
  };
  return activeClose;
}

export function closeModal() {
  if (activeClose) activeClose();
}

// ── Form building blocks ─────────────────────────────────────────────────────

function field(label, control, hint) {
  return el("label.field", {}, [
    el("span.field__label", {}, label),
    control,
    hint ? el("span.field__hint", {}, hint) : null,
  ]);
}

function input(attrs) {
  return el("input.input", { type: "text", ...attrs });
}

function select(attrs, options) {
  const node = el("select.input", attrs);
  for (const opt of options) {
    node.appendChild(el("option", { value: opt.value, selected: opt.value === attrs.value }, opt.label));
  }
  return node;
}

function row(children, cols = 2) {
  return el("div.form-row", { style: { "--cols": cols } }, children);
}

function button(label, attrs = {}) {
  const { iconName, ...rest } = attrs;
  return el("button.btn", { type: "button", ...rest }, [iconName ? icon(iconName) : null, el("span", {}, label)]);
}

// ── Shift editor ─────────────────────────────────────────────────────────────

export function openShiftEditor({ shiftId = null, date, employeeId = null } = {}) {
  const state = getState();
  const existing = shiftId ? state.shifts.find((s) => s.id === shiftId) : null;
  const draft = existing
    ? { ...existing }
    : {
        id: null,
        employeeId: employeeId ?? null,
        date: date || state.ui.anchorDate,
        start: "09:00",
        end: "17:00",
        breakMinutes: 30,
        role: state.employees.find((e) => e.id === employeeId)?.role || state.settings.roles[0] || "",
        location: state.settings.locations[0] || "",
        notes: "",
        published: false,
      };

  const warnings = el("div.warnings", { "aria-live": "polite" });

  const refreshWarnings = () => {
    const candidate = { ...draft, id: draft.id || "__draft__" };
    const others = state.shifts.filter((s) => s.id !== draft.id);
    const issues = detectConflicts({
      shifts: [...others, candidate],
      employees: state.employees,
      timeOff: state.timeOff,
      settings: state.settings,
    }).filter((i) => i.shiftId === candidate.id || (i.employeeId && i.employeeId === candidate.employeeId && !i.shiftId));

    const hours = shiftHours(candidate);
    mount(warnings, [
      el("div.warnings__hours", {}, [
        icon("clock"),
        el("span", {}, `${formatHours(hours)} paid${draft.breakMinutes ? ` · ${draft.breakMinutes}m unpaid break` : ""}`),
      ]),
      ...issues.map((issue) =>
        el(`div.warn.warn--${issue.severity}`, {}, [
          icon(issue.severity === "error" ? "warn" : "clock"),
          el("span", {}, `${CONFLICT_TYPES[issue.type]?.label || issue.type}: ${issue.message}`),
        ])
      ),
    ]);
  };

  const bind = (key, transform = (v) => v) => (event) => {
    draft[key] = transform(event.target.value);
    refreshWarnings();
  };

  const employeeOptions = [
    { value: "", label: "— Open shift (unassigned) —" },
    ...state.employees.filter((e) => e.active !== false).map((e) => ({ value: e.id, label: `${e.name} · ${e.role || "No role"}` })),
  ];

  const body = [
    row([
      field("Assigned to", select({ value: draft.employeeId || "", "data-autofocus": "", onchange: bind("employeeId", (v) => v || null) }, employeeOptions)),
      field("Date", input({ type: "date", value: draft.date, onchange: bind("date") })),
    ]),
    row([
      field("Starts", input({ type: "time", value: draft.start, onchange: bind("start") })),
      field("Ends", input({ type: "time", value: draft.end, onchange: bind("end") }), "An earlier end time means the shift runs overnight."),
    ]),
    row([
      field("Unpaid break (minutes)", input({ type: "number", min: "0", step: "5", value: draft.breakMinutes, onchange: bind("breakMinutes", (v) => Number(v) || 0) })),
      field("Role", select({ value: draft.role || "", onchange: bind("role") }, [{ value: "", label: "— None —" }, ...state.settings.roles.map((r) => ({ value: r, label: r }))])),
    ]),
    row([
      field("Location", select({ value: draft.location || "", onchange: bind("location") }, [{ value: "", label: "— None —" }, ...state.settings.locations.map((l) => ({ value: l, label: l }))])),
      field("Status", select({ value: draft.published ? "published" : "draft", onchange: bind("published", (v) => v === "published") }, [
        { value: "draft", label: "Draft — not visible to staff" },
        { value: "published", label: "Published" },
      ])),
    ]),
    field("Notes", el("textarea.input", { rows: "2", placeholder: "Anything the team should know…", onchange: bind("notes") }, draft.notes || "")),
    warnings,
  ];

  const save = () => {
    if (Number.isNaN(parseTime(draft.start)) || Number.isNaN(parseTime(draft.end))) {
      toast("Enter a valid start and end time.", "error");
      return;
    }
    if (!draft.date) {
      toast("Pick a date for this shift.", "error");
      return;
    }
    upsertShift(draft.id ? draft : { ...draft, id: undefined });
    closeModal();
    toast(draft.id ? "Shift updated." : "Shift added.", "success");
  };

  const footer = [
    existing
      ? el("div.modal__foot-left", {}, [
          button("Duplicate", { iconName: "copy", class: "btn btn--ghost", onclick: () => { duplicateShift(existing.id); closeModal(); toast("Shift duplicated."); } }),
          button("Delete", { iconName: "trash", class: "btn btn--ghost btn--danger", onclick: () => {
            if (confirmDialog("Delete this shift?")) { removeShift(existing.id); closeModal(); toast("Shift deleted."); }
          } }),
        ])
      : el("div.modal__foot-left"),
    button("Cancel", { class: "btn btn--ghost", onclick: () => closeModal() }),
    button(existing ? "Save shift" : "Add shift", { class: "btn btn--primary", iconName: "check", onclick: save }),
  ];

  openModal({
    title: existing ? "Edit shift" : "New shift",
    subtitle: existing ? "Changes apply as soon as you save." : "Assign now or leave it open for someone to pick up.",
    body,
    footer,
  });
  refreshWarnings();
}

// ── Employee editor ──────────────────────────────────────────────────────────

export function openEmployeeEditor(employeeId = null) {
  const state = getState();
  const existing = employeeId ? state.employees.find((e) => e.id === employeeId) : null;
  const blankAvailability = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const draft = existing
    ? { ...existing, availability: { ...blankAvailability, ...(existing.availability || {}) } }
    : {
        id: null,
        name: "",
        role: state.settings.roles[0] || "",
        email: "",
        phone: "",
        color: PALETTE[state.employees.length % PALETTE.length],
        hourlyRate: 0,
        maxHoursPerWeek: 40,
        minHoursPerWeek: 0,
        active: true,
        availability: { 0: [], 1: [{ start: "09:00", end: "17:00" }], 2: [{ start: "09:00", end: "17:00" }], 3: [{ start: "09:00", end: "17:00" }], 4: [{ start: "09:00", end: "17:00" }], 5: [{ start: "09:00", end: "17:00" }], 6: [] },
      };

  const bind = (key, transform = (v) => v) => (event) => { draft[key] = transform(event.target.value); };

  const swatches = el("div.swatches", { role: "radiogroup", "aria-label": "Colour" },
    PALETTE.map((hex) =>
      el("button.swatch", {
        type: "button",
        role: "radio",
        "aria-checked": String(hex === draft.color),
        "aria-label": `Colour ${hex}`,
        style: { background: hex },
        class: hex === draft.color ? "swatch is-selected" : "swatch",
        onclick: (event) => {
          draft.color = hex;
          event.currentTarget.parentElement.querySelectorAll(".swatch").forEach((s) => {
            s.classList.remove("is-selected");
            s.setAttribute("aria-checked", "false");
          });
          event.currentTarget.classList.add("is-selected");
          event.currentTarget.setAttribute("aria-checked", "true");
        },
      })
    )
  );

  const availabilityRows = DAY_NAMES.map((name, day) => {
    const windows = draft.availability[day] || [];
    const enabled = windows.length > 0;
    const start = windows[0]?.start || "09:00";
    const end = windows[0]?.end || "17:00";

    const startInput = input({ type: "time", value: start, disabled: !enabled, onchange: (e) => {
      draft.availability[day] = [{ start: e.target.value, end: endInput.value }];
    } });
    const endInput = input({ type: "time", value: end, disabled: !enabled, onchange: (e) => {
      draft.availability[day] = [{ start: startInput.value, end: e.target.value }];
    } });
    const toggle = el("input", { type: "checkbox", checked: enabled, onchange: (e) => {
      startInput.disabled = !e.target.checked;
      endInput.disabled = !e.target.checked;
      draft.availability[day] = e.target.checked ? [{ start: startInput.value, end: endInput.value }] : [];
    } });

    return el("div.avail-row", {}, [
      el("label.avail-row__day", {}, [toggle, el("span", {}, DAY_SHORT[day])]),
      startInput,
      el("span.avail-row__dash", {}, "to"),
      endInput,
    ]);
  });

  const body = [
    row([
      field("Full name", input({ value: draft.name, placeholder: "Jordan Pike", "data-autofocus": "", onchange: bind("name") })),
      field("Role", el("div.combo", {}, [
        input({ value: draft.role, list: "role-presets", placeholder: "Barista", onchange: bind("role") }),
        el("datalist#role-presets", {}, [...new Set([...state.settings.roles, ...ROLE_PRESETS])].map((r) => el("option", { value: r }))),
      ])),
    ]),
    row([
      field("Email", input({ type: "email", value: draft.email || "", placeholder: "jordan@example.com", onchange: bind("email") })),
      field("Phone", input({ type: "tel", value: draft.phone || "", placeholder: "555-0100", onchange: bind("phone") })),
    ]),
    row([
      field("Hourly rate", input({ type: "number", min: "0", step: "0.5", value: draft.hourlyRate || 0, onchange: bind("hourlyRate", Number) })),
      field("Status", select({ value: draft.active === false ? "inactive" : "active", onchange: bind("active", (v) => v === "active") }, [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive — hidden from the grid" },
      ])),
    ], 2),
    row([
      field("Min hours / week", input({ type: "number", min: "0", step: "1", value: draft.minHoursPerWeek || 0, onchange: bind("minHoursPerWeek", Number) })),
      field("Max hours / week", input({ type: "number", min: "0", step: "1", value: draft.maxHoursPerWeek ?? 40, onchange: bind("maxHoursPerWeek", Number) }), "Scheduling past this flags overtime."),
    ]),
    field("Colour", swatches),
    el("div.subhead", {}, [el("h3", {}, "Weekly availability"), el("p", {}, "Shifts outside these windows are flagged, not blocked.")]),
    el("div.avail-grid", {}, availabilityRows),
  ];

  const save = () => {
    if (!draft.name.trim()) {
      toast("An employee needs a name.", "error");
      return;
    }
    upsertEmployee(draft.id ? draft : { ...draft, id: undefined });
    closeModal();
    toast(draft.id ? "Employee updated." : `${draft.name} added to the team.`, "success");
  };

  const footer = [
    existing
      ? el("div.modal__foot-left", {}, button("Remove", { iconName: "trash", class: "btn btn--ghost btn--danger", onclick: () => {
          if (confirmDialog(`Remove ${existing.name}? Their shifts become open shifts.`)) {
            removeEmployee(existing.id);
            closeModal();
            toast(`${existing.name} removed.`);
          }
        } }))
      : el("div.modal__foot-left"),
    button("Cancel", { class: "btn btn--ghost", onclick: () => closeModal() }),
    button(existing ? "Save changes" : "Add employee", { class: "btn btn--primary", iconName: "check", onclick: save }),
  ];

  openModal({ title: existing ? `Edit ${existing.name}` : "Add employee", body, footer, size: "lg" });
}

// ── Time-off editor ──────────────────────────────────────────────────────────

export function openTimeOffEditor(requestId = null) {
  const state = getState();
  const existing = requestId ? state.timeOff.find((t) => t.id === requestId) : null;
  const draft = existing
    ? { ...existing }
    : {
        id: null,
        employeeId: state.employees[0]?.id || "",
        startDate: todayISO(),
        endDate: addDays(todayISO(), 1),
        reason: "Vacation",
        status: "pending",
        note: "",
      };

  const bind = (key, transform = (v) => v) => (event) => { draft[key] = transform(event.target.value); };

  const body = [
    field("Employee", select({ value: draft.employeeId, "data-autofocus": "", onchange: bind("employeeId") },
      state.employees.map((e) => ({ value: e.id, label: e.name })))),
    row([
      field("First day", input({ type: "date", value: draft.startDate, onchange: bind("startDate") })),
      field("Last day", input({ type: "date", value: draft.endDate, onchange: bind("endDate") })),
    ]),
    row([
      field("Reason", select({ value: draft.reason, onchange: bind("reason") },
        ["Vacation", "Sick leave", "Medical appointment", "Personal", "Parental leave", "Unpaid leave"].map((r) => ({ value: r, label: r })))),
      field("Status", select({ value: draft.status, onchange: bind("status") }, [
        { value: "pending", label: "Pending" },
        { value: "approved", label: "Approved — blocks scheduling" },
        { value: "denied", label: "Denied" },
      ])),
    ]),
    field("Note", el("textarea.input", { rows: "2", onchange: bind("note") }, draft.note || "")),
  ];

  const save = () => {
    if (!draft.employeeId) {
      toast("Choose an employee.", "error");
      return;
    }
    if (draft.endDate < draft.startDate) {
      toast("The last day cannot be before the first day.", "error");
      return;
    }
    upsertTimeOff(draft.id ? draft : { ...draft, id: undefined });
    closeModal();
    toast("Time-off request saved.", "success");
  };

  const footer = [
    existing
      ? el("div.modal__foot-left", {}, button("Delete", { iconName: "trash", class: "btn btn--ghost btn--danger", onclick: () => {
          if (confirmDialog("Delete this request?")) { removeTimeOff(existing.id); closeModal(); toast("Request deleted."); }
        } }))
      : el("div.modal__foot-left"),
    button("Cancel", { class: "btn btn--ghost", onclick: () => closeModal() }),
    button("Save request", { class: "btn btn--primary", iconName: "check", onclick: save }),
  ];

  openModal({ title: existing ? "Edit time off" : "Request time off", body, footer });
}

// ── Settings ─────────────────────────────────────────────────────────────────

function listEditor(values, onChange, placeholder) {
  const host = el("div.taglist");
  const render = () => {
    mount(host, [
      ...values.map((value, index) =>
        el("span.tag", {}, [
          value,
          el("button.tag__x", { type: "button", "aria-label": `Remove ${value}`, onclick: () => { values.splice(index, 1); onChange(values); render(); } }, icon("close")),
        ])
      ),
      el("input.input.input--tag", {
        placeholder,
        onkeydown: (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const value = event.target.value.trim();
          if (!value || values.includes(value)) return;
          values.push(value);
          onChange(values);
          render();
          host.querySelector(".input--tag")?.focus();
        },
      }),
    ]);
  };
  render();
  return host;
}

export function openSettings() {
  const state = getState();
  const settings = { ...state.settings };
  const roles = [...settings.roles];
  const locations = [...settings.locations];

  const bind = (key, transform = (v) => v) => (event) => { settings[key] = transform(event.target.value); };

  const importFile = el("input", { type: "file", accept: "application/json", style: { display: "none" }, onchange: (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        replaceAll(JSON.parse(String(reader.result)));
        closeModal();
        toast("Schedule imported.", "success");
      } catch (err) {
        toast("That file isn't a valid schedule export.", "error");
      }
    };
    reader.readAsText(file);
  } });

  const body = [
    row([
      field("Organisation name", input({ value: settings.orgName, "data-autofocus": "", onchange: bind("orgName") })),
      field("Currency symbol", input({ value: settings.currency, maxlength: "3", onchange: bind("currency") })),
    ]),
    row([
      field("Week starts on", select({ value: String(settings.weekStart), onchange: bind("weekStart", Number) }, [
        { value: "1", label: "Monday" },
        { value: "0", label: "Sunday" },
      ])),
      field("Time format", select({ value: settings.hour12 ? "12" : "24", onchange: bind("hour12", (v) => v === "12") }, [
        { value: "24", label: "24-hour (17:00)" },
        { value: "12", label: "12-hour (5:00 PM)" },
      ])),
    ]),
    row([
      field("Overtime after (hours/week)", input({ type: "number", min: "1", step: "1", value: settings.overtimeThreshold, onchange: bind("overtimeThreshold", Number) }), "Used when an employee has no personal cap."),
      field("Minimum rest between shifts (hours)", input({ type: "number", min: "0", step: "1", value: settings.minRestHours, onchange: bind("minRestHours", Number) })),
    ]),
    field("Roles", listEditor(roles, () => {}, "Add a role, then press Enter")),
    field("Locations", listEditor(locations, () => {}, "Add a location, then press Enter")),
    el("div.subhead", {}, [el("h3", {}, "Your data"), el("p", {}, "Everything lives in this browser. Export to keep a copy or move it elsewhere.")]),
    el("div.btn-row", {}, [
      button("Export JSON", { iconName: "download", class: "btn btn--ghost", onclick: () => {
        const blob = new Blob([exportJSON()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = el("a", { href: url, download: `schedule-${todayISO()}.json` });
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } }),
      button("Import JSON", { iconName: "upload", class: "btn btn--ghost", onclick: () => importFile.click() }),
      button("Reload demo data", { iconName: "copy", class: "btn btn--ghost", onclick: () => {
        if (confirmDialog("Replace everything with the demo roster?")) { resetToDemo(); closeModal(); toast("Demo data restored."); }
      } }),
      button("Delete everything", { iconName: "trash", class: "btn btn--ghost btn--danger", onclick: () => {
        if (confirmDialog("Delete all employees, shifts and time off? This cannot be undone.")) {
          clearEverything();
          closeModal();
          toast("All data cleared.");
        }
      } }),
      importFile,
    ]),
  ];

  const footer = [
    el("div.modal__foot-left"),
    button("Cancel", { class: "btn btn--ghost", onclick: () => closeModal() }),
    button("Save settings", { class: "btn btn--primary", iconName: "check", onclick: () => {
      setSettings({ ...settings, roles, locations });
      closeModal();
      toast("Settings saved.", "success");
    } }),
  ];

  openModal({ title: "Settings", body, footer, size: "lg" });
}
