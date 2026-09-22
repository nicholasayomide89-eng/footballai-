// Reports: hours and cost per person, per day and per role for the open week.

import { el, icon, initials, contrastText } from "../dom.js";
import { currentWeekDates } from "../store.js";
import { downloadCSV } from "../export.js";
import {
  DAY_SHORT, dayOfWeek, shiftMinutes, formatHours, formatDateLabel, formatRangeLabel,
  hoursForEmployee, weekSummary,
} from "../scheduling.js";

function bar(value, max, color) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return el("div.bar", { "aria-hidden": "true" }, el("div.bar__fill", { style: { width: `${pct}%`, background: color } }));
}

export function renderReports(state) {
  const dates = currentWeekDates(state);
  const weekShifts = state.shifts.filter((s) => dates.includes(s.date));
  const summary = weekSummary({ shifts: state.shifts, employees: state.employees, timeOff: state.timeOff, settings: state.settings, dates });
  const currency = state.settings.currency;

  const perPerson = state.employees
    .map((employee) => {
      const hours = hoursForEmployee(state.shifts, employee.id, dates);
      return {
        employee,
        hours,
        cost: hours * Number(employee.hourlyRate || 0),
        shifts: weekShifts.filter((s) => s.employeeId === employee.id).length,
      };
    })
    .filter((row) => row.hours > 0 || row.employee.active !== false)
    .sort((a, b) => b.hours - a.hours);

  const maxHours = Math.max(1, ...perPerson.map((r) => r.hours));

  const perDay = dates.map((dateISO) => ({
    dateISO,
    hours: weekShifts.filter((s) => s.date === dateISO).reduce((sum, s) => sum + shiftMinutes(s), 0) / 60,
  }));
  const maxDay = Math.max(1, ...perDay.map((d) => d.hours));

  const roleTotals = new Map();
  for (const shift of weekShifts) {
    const key = shift.role || "Unassigned role";
    roleTotals.set(key, (roleTotals.get(key) || 0) + shiftMinutes(shift) / 60);
  }
  const perRole = [...roleTotals.entries()].sort((a, b) => b[1] - a[1]);
  const maxRole = Math.max(1, ...perRole.map(([, hours]) => hours));

  return el("section.view", {}, [
    el("div.view__bar", {}, [
      el("div.view__title", {}, [
        el("h2", {}, "Reports"),
        el("p", {}, formatRangeLabel(dates)),
      ]),
      el("div.btn-row", {}, [
        el("button.btn.btn--ghost", { type: "button", onclick: () => downloadCSV(state, dates) }, [icon("download"), el("span", {}, "Export CSV")]),
        el("button.btn.btn--ghost", { type: "button", onclick: () => window.print() }, [icon("print"), el("span", {}, "Print")]),
      ]),
    ]),

    el("div.stats.stats--wide", {}, [
      el("div.stat", {}, [el("span.stat__value", {}, formatHours(summary.totalHours)), el("span.stat__label", {}, "Total scheduled hours")]),
      el("div.stat", {}, [el("span.stat__value", {}, `${currency}${summary.laborCost.toFixed(2)}`), el("span.stat__label", {}, "Estimated labour cost")]),
      el("div.stat", {}, [el("span.stat__value", {}, String(summary.shiftCount)), el("span.stat__label", {}, "Shifts")]),
      el("div.stat", {}, [el("span.stat__value", {}, summary.shiftCount ? formatHours(summary.totalHours / summary.shiftCount) : "—"), el("span.stat__label", {}, "Average shift")]),
    ]),

    el("div.report-grid", {}, [
      el("section.report", {}, [
        el("h3", {}, "Hours by person"),
        perPerson.length
          ? el("table.table", {}, [
              el("thead", {}, el("tr", {}, [el("th", {}, "Employee"), el("th", {}, "Shifts"), el("th", {}, "Hours"), el("th", {}, "Cost"), el("th", {}, "")])),
              el("tbody", {}, perPerson.map(({ employee, hours, cost, shifts }) =>
                el("tr", {}, [
                  el("td", {}, el("div.table__person", {}, [
                    el("span.avatar.avatar--sm", { style: { background: employee.color, color: contrastText(employee.color) } }, initials(employee.name)),
                    el("span", {}, employee.name),
                  ])),
                  el("td", {}, String(shifts)),
                  el("td", { class: hours > Number(employee.maxHoursPerWeek ?? 40) ? "is-over" : "" }, formatHours(hours)),
                  el("td", {}, cost ? `${currency}${cost.toFixed(2)}` : "—"),
                  el("td.table__bar", {}, bar(hours, maxHours, employee.color)),
                ])
              )),
            ])
          : el("p.muted", {}, "No hours scheduled this week."),
      ]),

      el("section.report", {}, [
        el("h3", {}, "Coverage by day"),
        el("ul.breakdown", {}, perDay.map(({ dateISO, hours }) =>
          el("li", {}, [
            el("span.breakdown__label", {}, `${DAY_SHORT[dayOfWeek(dateISO)]} ${formatDateLabel(dateISO)}`),
            bar(hours, maxDay, "var(--accent)"),
            el("span.breakdown__value", {}, hours ? formatHours(hours) : "—"),
          ])
        )),
      ]),

      el("section.report", {}, [
        el("h3", {}, "Hours by role"),
        perRole.length
          ? el("ul.breakdown", {}, perRole.map(([role, hours]) =>
              el("li", {}, [
                el("span.breakdown__label", {}, role),
                bar(hours, maxRole, "var(--accent)"),
                el("span.breakdown__value", {}, formatHours(hours)),
              ])
            ))
          : el("p.muted", {}, "No shifts to break down yet."),
      ]),
    ]),
  ]);
}
