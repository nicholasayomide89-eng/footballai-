// Roster view: everyone on the team, their load this week, and availability.

import { el, icon, initials, contrastText } from "../dom.js";
import { currentWeekDates } from "../store.js";
import { openEmployeeEditor } from "../modals.js";
import { DAY_SHORT, hoursForEmployee, formatHours, parseTime, formatTime } from "../scheduling.js";

function availabilityStrip(employee, hour12) {
  const availability = employee.availability;
  return el("div.strip", { "aria-hidden": "false", role: "list" },
    DAY_SHORT.map((label, day) => {
      const windows = availability ? availability[day] || [] : null;
      const open = windows === null || windows.length > 0;
      const detail = windows && windows.length
        ? windows.map((w) => `${formatTime(parseTime(w.start), hour12)}–${formatTime(parseTime(w.end), hour12)}`).join(", ")
        : windows === null
          ? "No availability set"
          : "Unavailable";
      return el("span.strip__day", {
        role: "listitem",
        class: open ? "strip__day is-open" : "strip__day",
        title: `${label}: ${detail}`,
      }, label);
    })
  );
}

export function renderPeople(state) {
  const dates = currentWeekDates(state);
  const search = state.ui.search.trim().toLowerCase();
  const people = state.employees
    .filter((e) => !search || `${e.name} ${e.role || ""} ${e.email || ""}`.toLowerCase().includes(search))
    .sort((a, b) => (a.active === false) - (b.active === false) || a.name.localeCompare(b.name));

  const cards = people.map((employee) => {
    const scheduled = hoursForEmployee(state.shifts, employee.id, dates);
    const max = Number(employee.maxHoursPerWeek ?? state.settings.overtimeThreshold);
    const pct = max > 0 ? Math.min(100, (scheduled / max) * 100) : 0;
    const over = scheduled > max;

    return el("article.card", {
      class: employee.active === false ? "card card--inactive" : "card",
      tabindex: "0",
      role: "button",
      "aria-label": `Edit ${employee.name}`,
      onclick: () => openEmployeeEditor(employee.id),
      onkeydown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openEmployeeEditor(employee.id);
        }
      },
    }, [
      el("header.card__head", {}, [
        el("span.avatar.avatar--lg", { style: { background: employee.color, color: contrastText(employee.color) } }, initials(employee.name)),
        el("div", {}, [
          el("h3.card__name", {}, employee.name),
          el("p.card__role", {}, [employee.role || "No role", employee.active === false ? el("span.pill", {}, "Inactive") : null]),
        ]),
      ]),
      el("dl.card__facts", {}, [
        el("div", {}, [el("dt", {}, "This week"), el("dd", { class: over ? "is-over" : "" }, `${formatHours(scheduled)} / ${max}h`)]),
        el("div", {}, [el("dt", {}, "Rate"), el("dd", {}, employee.hourlyRate ? `${state.settings.currency}${Number(employee.hourlyRate).toFixed(2)}/h` : "—")]),
        el("div", {}, [el("dt", {}, "Email"), el("dd", {}, employee.email || "—")]),
        el("div", {}, [el("dt", {}, "Phone"), el("dd", {}, employee.phone || "—")]),
      ]),
      el("div.meter", { "aria-hidden": "true" }, el("div.meter__fill", { class: over ? "meter__fill is-over" : "meter__fill", style: { width: `${pct}%`, background: over ? undefined : employee.color } })),
      availabilityStrip(employee, state.settings.hour12),
    ]);
  });

  return el("section.view", {}, [
    el("div.view__bar", {}, [
      el("div.view__title", {}, [
        el("h2", {}, "Team"),
        el("p", {}, `${state.employees.filter((e) => e.active !== false).length} active · ${state.employees.length} total`),
      ]),
      el("button.btn.btn--primary", { type: "button", onclick: () => openEmployeeEditor() }, [icon("plus"), el("span", {}, "Add employee")]),
    ]),
    people.length
      ? el("div.cards", {}, cards)
      : el("div.empty", {}, [
          icon("users"),
          el("h3", {}, state.employees.length ? "Nobody matches that search" : "No employees yet"),
          el("p", {}, state.employees.length ? "Try a different name or role." : "Add your first team member to start building a schedule."),
          el("button.btn.btn--primary", { type: "button", onclick: () => openEmployeeEditor() }, [icon("plus"), el("span", {}, "Add employee")]),
        ]),
  ]);
}
