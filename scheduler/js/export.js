// CSV export of a week's shifts — one row per shift, ready for payroll.

import { toast } from "./dom.js";
import { shiftHours, dayOfWeek, DAY_NAMES, parseTime } from "./scheduling.js";

function escapeCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCSV(state, dates) {
  const header = ["Date", "Day", "Employee", "Role", "Location", "Start", "End", "Break (min)", "Paid hours", "Hourly rate", "Cost", "Status", "Notes"];
  const rows = state.shifts
    .filter((s) => dates.includes(s.date))
    .sort((a, b) => a.date.localeCompare(b.date) || (parseTime(a.start) - parseTime(b.start)))
    .map((shift) => {
      const employee = state.employees.find((e) => e.id === shift.employeeId);
      const hours = shiftHours(shift);
      const rate = Number(employee?.hourlyRate || 0);
      return [
        shift.date,
        DAY_NAMES[dayOfWeek(shift.date)],
        employee?.name || "OPEN SHIFT",
        shift.role || "",
        shift.location || "",
        shift.start,
        shift.end,
        shift.breakMinutes || 0,
        hours.toFixed(2),
        rate ? rate.toFixed(2) : "",
        rate ? (hours * rate).toFixed(2) : "",
        shift.published ? "Published" : "Draft",
        shift.notes || "",
      ];
    });

  return [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
}

export function downloadCSV(state, dates) {
  const csv = toCSV(state, dates);
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `schedule-${dates[0]}-to-${dates[dates.length - 1]}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast("CSV exported.", "success");
}
