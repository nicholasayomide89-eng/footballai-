// The week grid: employees down the side, days across the top.

import { el, icon, initials, contrastText, toast, confirmDialog } from "../dom.js";
import { moveShift, publishWeek, copyPreviousWeek, clearWeek, currentWeekDates } from "../store.js";
import { openShiftEditor } from "../modals.js";
import {
  DAY_SHORT, todayISO, formatTime, parseTime, shiftMinutes, shiftHours, formatHours,
  formatDateLabel, detectConflicts, hoursForEmployee, weekSummary, timeOffOn,
  crossesMidnight, CONFLICT_TYPES, dayOfWeek,
} from "../scheduling.js";

function timeLabel(value, hour12) {
  const minutes = parseTime(value);
  return Number.isNaN(minutes) ? value : formatTime(minutes, hour12);
}

function matchesFilters(shift, state) {
  const { roleFilter, locationFilter } = state.ui;
  if (roleFilter && shift.role !== roleFilter) return false;
  if (locationFilter && shift.location !== locationFilter) return false;
  return true;
}

function shiftCard(shift, employee, issues, state) {
  const hour12 = state.settings.hour12;
  const own = issues.filter((i) => i.shiftId === shift.id);
  const worst = own.some((i) => i.severity === "error") ? "error" : own.some((i) => i.severity === "warning") ? "warning" : null;
  const accent = employee?.color || "#94a3b8";

  const card = el("article.shift", {
    class: `shift${worst ? ` shift--${worst}` : ""}${shift.published ? "" : " shift--draft"}`,
    draggable: "true",
    tabindex: "0",
    role: "button",
    style: { "--accent": accent },
    title: own.length ? own.map((i) => i.message).join("\n") : `${shift.start}–${shift.end}${shift.role ? ` · ${shift.role}` : ""}`,
    "aria-label": `${employee ? employee.name : "Open shift"}, ${timeLabel(shift.start, hour12)} to ${timeLabel(shift.end, hour12)}${shift.role ? `, ${shift.role}` : ""}${own.length ? `, ${own.length} issue${own.length > 1 ? "s" : ""}` : ""}`,
    onclick: (event) => {
      event.stopPropagation();
      openShiftEditor({ shiftId: shift.id });
    },
    onkeydown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        openShiftEditor({ shiftId: shift.id });
      }
    },
    ondragstart: (event) => {
      event.dataTransfer.setData("text/plain", shift.id);
      event.dataTransfer.effectAllowed = "move";
      card.classList.add("is-dragging");
    },
    ondragend: () => card.classList.remove("is-dragging"),
  }, [
    el("div.shift__time", {}, [
      `${timeLabel(shift.start, hour12)} – ${timeLabel(shift.end, hour12)}`,
      crossesMidnight(shift) ? el("span.shift__overnight", { title: "Runs overnight" }, "+1") : null,
    ]),
    shift.role ? el("div.shift__role", {}, shift.role) : null,
    el("div.shift__meta", {}, [
      el("span", {}, formatHours(shiftHours(shift))),
      shift.published ? null : el("span.shift__tag", {}, "Draft"),
      worst ? el("span.shift__warn", { "aria-hidden": "true" }, icon("warn")) : null,
    ]),
  ]);
  return card;
}

function dayCell({ dateISO, employee, state, issues }) {
  const shifts = state.shifts
    .filter((s) => s.date === dateISO && (s.employeeId || null) === (employee ? employee.id : null) && matchesFilters(s, state))
    .sort((a, b) => parseTime(a.start) - parseTime(b.start));

  const leave = employee ? timeOffOn(state.timeOff, employee.id, dateISO) : null;
  const unavailable = employee?.availability && (employee.availability[dayOfWeek(dateISO)] || []).length === 0;

  const cell = el("div.cell", {
    class: `cell${leave ? " cell--leave" : ""}${unavailable && !leave ? " cell--off" : ""}${dateISO === todayISO() ? " cell--today" : ""}`,
    tabindex: "0",
    role: "gridcell",
    "aria-label": `${employee ? employee.name : "Open shifts"}, ${formatDateLabel(dateISO, { weekday: "long" })}, ${shifts.length} shift${shifts.length === 1 ? "" : "s"}`,
    onclick: () => openShiftEditor({ date: dateISO, employeeId: employee?.id ?? null }),
    onkeydown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openShiftEditor({ date: dateISO, employeeId: employee?.id ?? null });
      }
    },
    ondragover: (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      cell.classList.add("is-drop-target");
    },
    ondragleave: () => cell.classList.remove("is-drop-target"),
    ondrop: (event) => {
      event.preventDefault();
      cell.classList.remove("is-drop-target");
      const shiftId = event.dataTransfer.getData("text/plain");
      if (!shiftId) return;
      const moved = state.shifts.find((s) => s.id === shiftId);
      if (!moved) return;
      if (moved.date === dateISO && (moved.employeeId || null) === (employee?.id ?? null)) return;
      moveShift(shiftId, { date: dateISO, employeeId: employee ? employee.id : null });
      toast(employee ? `Moved to ${employee.name}, ${formatDateLabel(dateISO)}.` : `Moved to open shifts, ${formatDateLabel(dateISO)}.`);
    },
  }, [
    leave ? el("div.cell__leave", {}, [icon("away"), el("span", {}, leave.reason || "Time off")]) : null,
    ...shifts.map((shift) => shiftCard(shift, employee, issues, state)),
    el("button.cell__add", { type: "button", tabindex: "-1", "aria-hidden": "true" }, icon("plus")),
  ]);
  return cell;
}

function employeeRow({ employee, dates, state, issues }) {
  const scheduled = hoursForEmployee(state.shifts.filter((s) => matchesFilters(s, state)), employee.id, dates);
  const max = Number(employee.maxHoursPerWeek ?? state.settings.overtimeThreshold);
  const min = Number(employee.minHoursPerWeek || 0);
  const pct = max > 0 ? Math.min(100, (scheduled / max) * 100) : 0;
  const over = scheduled > max;
  const under = min > 0 && scheduled < min;

  return [
    el("div.person", { role: "rowheader" }, [
      el("span.avatar", { style: { background: employee.color, color: contrastText(employee.color) } }, initials(employee.name)),
      el("div.person__text", {}, [
        el("div.person__name", {}, employee.name),
        el("div.person__role", {}, employee.role || "No role"),
      ]),
      el("div.person__hours", { title: `${formatHours(scheduled)} scheduled of ${max}h maximum` }, [
        el("span", { class: over ? "is-over" : under ? "is-under" : "" }, formatHours(scheduled)),
        el("div.meter", { "aria-hidden": "true" }, el("div.meter__fill", { class: over ? "meter__fill is-over" : "meter__fill", style: { width: `${pct}%`, background: over ? undefined : employee.color } })),
      ]),
    ]),
    ...dates.map((dateISO) => dayCell({ dateISO, employee, state, issues })),
  ];
}

function issuePanel(issues, state) {
  if (!issues.length) {
    return el("div.panel.panel--ok", {}, [icon("check"), el("span", {}, "No conflicts this week.")]);
  }
  const order = { error: 0, warning: 1, info: 2 };
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const sorted = [...issues].sort((a, b) => order[a.severity] - order[b.severity]);
  const nameOf = (id) => state.employees.find((e) => e.id === id)?.name || "Open shift";

  return el("details.panel", { open: issues.some((i) => i.severity === "error") }, [
    el("summary.panel__summary", {}, [
      icon("warn"),
      el("span", {}, `${issues.length} thing${issues.length === 1 ? "" : "s"} to look at`),
      el("span.panel__counts", {}, [
        errors ? el("span.pill.pill--error", {}, `${errors} blocking`) : null,
        warnings ? el("span.pill.pill--warn", {}, `${warnings} warning${warnings === 1 ? "" : "s"}`) : null,
      ]),
    ]),
    el("ul.issues", {}, sorted.map((issue) =>
      el("li.issue", { class: `issue issue--${issue.severity}` }, [
        el("span.issue__type", {}, CONFLICT_TYPES[issue.type]?.label || issue.type),
        el("span.issue__who", {}, nameOf(issue.employeeId)),
        el("span.issue__msg", {}, issue.message),
        issue.shiftId
          ? el("button.link", { type: "button", onclick: () => openShiftEditor({ shiftId: issue.shiftId }) }, "Open shift")
          : null,
      ])
    )),
  ]);
}

export function renderSchedule(state) {
  const dates = currentWeekDates(state);
  const visibleShifts = state.shifts.filter((s) => matchesFilters(s, state));
  const issues = detectConflicts({ shifts: visibleShifts, employees: state.employees, timeOff: state.timeOff, settings: state.settings })
    .filter((i) => !i.shiftId || visibleShifts.some((s) => s.id === i.shiftId && dates.includes(s.date)))
    .filter((i) => !i.weekStart || i.weekStart === dates[0]);
  const summary = weekSummary({ shifts: visibleShifts, employees: state.employees, timeOff: state.timeOff, settings: state.settings, dates });

  const search = state.ui.search.trim().toLowerCase();
  let people = state.employees.filter((e) => e.active !== false);
  if (search) {
    people = people.filter((e) => `${e.name} ${e.role || ""}`.toLowerCase().includes(search));
  }
  if (state.ui.showOnlyIssues) {
    const flagged = new Set(issues.map((i) => i.employeeId).filter(Boolean));
    people = people.filter((e) => flagged.has(e.id));
  }

  const dailyTotals = dates.map((dateISO) =>
    visibleShifts.filter((s) => s.date === dateISO).reduce((sum, s) => sum + shiftMinutes(s), 0) / 60
  );

  const openShiftCount = visibleShifts.filter((s) => dates.includes(s.date) && !s.employeeId).length;

  const header = [
    el("div.grid__corner", {}, [
      el("span.grid__corner-label", {}, `${people.length} of ${state.employees.filter((e) => e.active !== false).length} shown`),
    ]),
    ...dates.map((dateISO, index) =>
      el("div.daycol", { class: `daycol${dateISO === todayISO() ? " daycol--today" : ""}`, role: "columnheader" }, [
        el("span.daycol__dow", {}, DAY_SHORT[dayOfWeek(dateISO)]),
        el("span.daycol__date", {}, formatDateLabel(dateISO)),
        el("span.daycol__hours", {}, dailyTotals[index] ? formatHours(dailyTotals[index]) : "—"),
      ])
    ),
  ];

  const openRow = [
    el("div.person.person--open", { role: "rowheader" }, [
      el("span.avatar.avatar--open", {}, icon("plus")),
      el("div.person__text", {}, [
        el("div.person__name", {}, "Open shifts"),
        el("div.person__role", {}, openShiftCount ? `${openShiftCount} waiting to be filled` : "Nothing unassigned"),
      ]),
    ]),
    ...dates.map((dateISO) => dayCell({ dateISO, employee: null, state, issues })),
  ];

  const grid = el("div.grid", {
    role: "grid",
    "aria-label": "Weekly schedule",
    style: { "--day-count": dates.length },
  }, [
    ...header,
    ...openRow,
    ...people.flatMap((employee) => employeeRow({ employee, dates, state, issues })),
    people.length === 0
      ? el("div.grid__empty", {}, [
          el("p", {}, state.employees.length ? "No employees match the current filters." : "No employees yet."),
        ])
      : null,
  ]);

  const stats = el("div.stats", {}, [
    el("div.stat", {}, [el("span.stat__value", {}, formatHours(summary.totalHours)), el("span.stat__label", {}, "Scheduled")]),
    el("div.stat", {}, [el("span.stat__value", {}, String(summary.shiftCount)), el("span.stat__label", {}, "Shifts")]),
    el("div.stat", {}, [el("span.stat__value", { class: summary.openShifts ? "stat__value is-warn" : "stat__value" }, String(summary.openShifts)), el("span.stat__label", {}, "Open")]),
    el("div.stat", {}, [el("span.stat__value", {}, `${state.settings.currency}${summary.laborCost.toFixed(0)}`), el("span.stat__label", {}, "Est. labour")]),
    el("div.stat", {}, [
      el("span.stat__value", { class: summary.errorCount ? "stat__value is-error" : "stat__value" }, String(summary.errorCount + summary.warningCount)),
      el("span.stat__label", {}, "Conflicts"),
    ]),
  ]);

  const actions = el("div.week-actions", {}, [
    el("button.btn.btn--ghost", { type: "button", onclick: () => { copyPreviousWeek(dates); toast("Last week's shifts copied into empty days."); } }, [icon("copy"), el("span", {}, "Copy last week")]),
    el("button.btn.btn--ghost", { type: "button", onclick: () => {
      if (confirmDialog("Delete every shift in this week?")) { clearWeek(dates); toast("Week cleared."); }
    } }, [icon("trash"), el("span", {}, "Clear week")]),
    el("button.btn.btn--primary", { type: "button", onclick: () => {
      publishWeek(dates, !summary.published);
      toast(summary.published ? "Week moved back to draft." : "Week published to the team.", "success");
    } }, [icon(summary.published ? "close" : "send"), el("span", {}, summary.published ? "Unpublish week" : "Publish week")]),
  ]);

  return el("section.view", {}, [
    el("div.view__bar", {}, [stats, actions]),
    issuePanel(issues, state),
    el("div.grid-scroll", {}, grid),
    el("p.hint", {}, "Tip: drag a shift onto another person or day to reassign it. Click an empty cell to add one."),
  ]);
}
