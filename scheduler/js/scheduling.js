// Pure scheduling logic. No DOM, no storage — safe to unit test in Node.

export const MINUTES_PER_DAY = 1440;
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "09:30" -> 570. Accepts "24:00" as end-of-day. Returns NaN when unparseable. */
export function parseTime(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min !== 0)) return NaN;
  return h * 60 + min;
}

/** 570 -> "09:30", or "9:30 AM" when hour12 is set. */
export function formatTime(minutes, hour12 = false) {
  const total = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!hour12) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "2026-09-22" -> Date at local midnight. */
export function parseDate(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date -> "2026-09-22" in local time (never UTC-shifted). */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDays(iso, amount) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + amount);
  return toISODate(d);
}

/** Whole days since the epoch — DST-proof, so it can anchor absolute minute math. */
export function dayIndex(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

export function dayOfWeek(iso) {
  return parseDate(iso).getDay();
}

export function daysBetween(fromISO, toISO) {
  return dayIndex(toISO) - dayIndex(fromISO);
}

/**
 * Absolute minute span of a shift, measured from the epoch.
 * An end at or before the start means the shift runs past midnight.
 */
export function shiftSpan(shift) {
  const base = dayIndex(shift.date) * MINUTES_PER_DAY;
  const start = parseTime(shift.start);
  let end = parseTime(shift.end);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (end <= start) end += MINUTES_PER_DAY;
  return { start: base + start, end: base + end };
}

/** Paid minutes: the clock span less the unpaid break. */
export function shiftMinutes(shift) {
  const span = shiftSpan(shift);
  if (!span) return 0;
  return Math.max(0, span.end - span.start - (Number(shift.breakMinutes) || 0));
}

export function shiftHours(shift) {
  return shiftMinutes(shift) / 60;
}

export function crossesMidnight(shift) {
  const start = parseTime(shift.start);
  const end = parseTime(shift.end);
  return !Number.isNaN(start) && !Number.isNaN(end) && end <= start;
}

/** Half-open overlap: touching edges (17:00 ends, 17:00 starts) do not overlap. */
export function overlaps(a, b) {
  if (!a || !b) return false;
  return a.start < b.end && b.start < a.end;
}

export function startOfWeek(iso, weekStartsOn = 1) {
  const dow = dayOfWeek(iso);
  const delta = (dow - weekStartsOn + 7) % 7;
  return addDays(iso, -delta);
}

export function weekDates(iso, weekStartsOn = 1) {
  const start = startOfWeek(iso, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function shiftsOn(shifts, iso) {
  return shifts.filter((s) => s.date === iso);
}

export function shiftsInRange(shifts, fromISO, toISO) {
  const from = dayIndex(fromISO);
  const to = dayIndex(toISO);
  return shifts.filter((s) => {
    const d = dayIndex(s.date);
    return d >= from && d <= to;
  });
}

export function minutesForEmployee(shifts, employeeId, dates) {
  const set = new Set(dates);
  return shifts
    .filter((s) => s.employeeId === employeeId && set.has(s.date))
    .reduce((total, s) => total + shiftMinutes(s), 0);
}

export function hoursForEmployee(shifts, employeeId, dates) {
  return minutesForEmployee(shifts, employeeId, dates) / 60;
}

/** Approved time off covering a date — pending requests never block a shift. */
export function timeOffOn(timeOff, employeeId, iso) {
  const day = dayIndex(iso);
  return (
    timeOff.find(
      (t) =>
        t.employeeId === employeeId &&
        t.status === "approved" &&
        dayIndex(t.startDate) <= day &&
        dayIndex(t.endDate) >= day
    ) || null
  );
}

/**
 * True when every minute of the shift falls inside a declared availability
 * window. An employee with no availability map is treated as always available;
 * an empty array for a day means "not available that day".
 */
export function isWithinAvailability(employee, shift) {
  const availability = employee && employee.availability;
  if (!availability) return true;
  const start = parseTime(shift.start);
  let end = parseTime(shift.end);
  if (Number.isNaN(start) || Number.isNaN(end)) return true;
  const overnight = end <= start;
  if (overnight) end += MINUTES_PER_DAY;

  const covers = (windows, from, to) =>
    (windows || []).some((w) => {
      const ws = parseTime(w.start);
      const we = parseTime(w.end);
      if (Number.isNaN(ws) || Number.isNaN(we)) return false;
      return ws <= from && (we === 0 ? MINUTES_PER_DAY : we) >= to;
    });

  const firstDay = availability[dayOfWeek(shift.date)];
  if (overnight) {
    const nextDay = availability[dayOfWeek(addDays(shift.date, 1))];
    return covers(firstDay, start, MINUTES_PER_DAY) && covers(nextDay, 0, end - MINUTES_PER_DAY);
  }
  return covers(firstDay, start, end);
}

export const CONFLICT_TYPES = {
  invalid: { label: "Invalid times", severity: "error" },
  overlap: { label: "Double-booked", severity: "error" },
  timeOff: { label: "On approved time off", severity: "error" },
  availability: { label: "Outside availability", severity: "warning" },
  rest: { label: "Short rest between shifts", severity: "warning" },
  overtime: { label: "Over weekly hours", severity: "warning" },
  understaffed: { label: "Below weekly minimum", severity: "info" },
  unassigned: { label: "Open shift", severity: "info" },
};

/**
 * Inspect a set of shifts and return every rule violation found.
 * Each issue carries the shift and/or employee it belongs to so the UI can
 * badge the right cell without re-deriving anything.
 */
export function detectConflicts({ shifts = [], employees = [], timeOff = [], settings = {} }) {
  const overtimeThreshold = Number(settings.overtimeThreshold ?? 40);
  const minRestHours = Number(settings.minRestHours ?? 8);
  const weekStartsOn = Number(settings.weekStart ?? 1);
  const byId = new Map(employees.map((e) => [e.id, e]));
  const issues = [];

  for (const shift of shifts) {
    const span = shiftSpan(shift);
    if (!span || span.end <= span.start) {
      issues.push({ type: "invalid", severity: "error", shiftId: shift.id, employeeId: shift.employeeId, message: "Shift times are missing or invalid." });
      continue;
    }
    if (!shift.employeeId) {
      issues.push({ type: "unassigned", severity: "info", shiftId: shift.id, employeeId: null, message: "Shift has nobody assigned." });
      continue;
    }
    const employee = byId.get(shift.employeeId);
    if (!employee) continue;

    const leave = timeOffOn(timeOff, shift.employeeId, shift.date);
    if (leave) {
      issues.push({ type: "timeOff", severity: "error", shiftId: shift.id, employeeId: employee.id, message: `${employee.name} has approved time off (${leave.reason || "time off"}).` });
    }
    if (!isWithinAvailability(employee, shift)) {
      issues.push({ type: "availability", severity: "warning", shiftId: shift.id, employeeId: employee.id, message: `${shift.start}–${shift.end} falls outside ${employee.name}'s stated availability.` });
    }
  }

  // Per-employee checks that need the whole set: overlaps and rest gaps.
  const assigned = shifts.filter((s) => s.employeeId && shiftSpan(s));
  const grouped = new Map();
  for (const shift of assigned) {
    if (!grouped.has(shift.employeeId)) grouped.set(shift.employeeId, []);
    grouped.get(shift.employeeId).push(shift);
  }

  for (const [employeeId, list] of grouped) {
    const employee = byId.get(employeeId);
    if (!employee) continue;
    const sorted = [...list].sort((a, b) => shiftSpan(a).start - shiftSpan(b).start);

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = shiftSpan(sorted[i]);
      const next = shiftSpan(sorted[i + 1]);
      if (overlaps(current, next)) {
        issues.push({ type: "overlap", severity: "error", shiftId: sorted[i + 1].id, relatedShiftId: sorted[i].id, employeeId, message: `${employee.name} is already booked ${sorted[i].start}–${sorted[i].end} on ${sorted[i].date}.` });
      } else {
        const restHours = (next.start - current.end) / 60;
        if (restHours < minRestHours) {
          issues.push({ type: "rest", severity: "warning", shiftId: sorted[i + 1].id, relatedShiftId: sorted[i].id, employeeId, message: `Only ${restHours.toFixed(1)}h rest after the previous shift (minimum ${minRestHours}h).` });
        }
      }
    }

    // Weekly totals, bucketed by the week each shift belongs to.
    const weeks = new Map();
    for (const shift of sorted) {
      const key = startOfWeek(shift.date, weekStartsOn);
      weeks.set(key, (weeks.get(key) || 0) + shiftMinutes(shift));
    }
    for (const [weekKey, minutes] of weeks) {
      const hours = minutes / 60;
      const max = Number(employee.maxHoursPerWeek ?? overtimeThreshold);
      const min = Number(employee.minHoursPerWeek ?? 0);
      if (hours > max) {
        issues.push({ type: "overtime", severity: "warning", employeeId, weekStart: weekKey, message: `${employee.name} is scheduled ${hours.toFixed(1)}h — ${(hours - max).toFixed(1)}h over their ${max}h weekly cap.` });
      } else if (min > 0 && hours < min) {
        issues.push({ type: "understaffed", severity: "info", employeeId, weekStart: weekKey, message: `${employee.name} is ${(min - hours).toFixed(1)}h short of their ${min}h weekly minimum.` });
      }
    }
  }

  return issues;
}

/** Roll-up used by the schedule header and the reports view. */
export function weekSummary({ shifts, employees, timeOff, settings, dates }) {
  const inWeek = shifts.filter((s) => dates.includes(s.date));
  const issues = detectConflicts({ shifts, employees, timeOff, settings });
  const weekIssues = issues.filter(
    (i) => !i.shiftId || inWeek.some((s) => s.id === i.shiftId)
  );
  const totalMinutes = inWeek.reduce((sum, s) => sum + shiftMinutes(s), 0);
  const laborCost = inWeek.reduce((sum, s) => {
    const employee = employees.find((e) => e.id === s.employeeId);
    const rate = Number(employee?.hourlyRate || 0);
    return sum + (shiftMinutes(s) / 60) * rate;
  }, 0);

  return {
    shiftCount: inWeek.length,
    openShifts: inWeek.filter((s) => !s.employeeId).length,
    published: inWeek.length > 0 && inWeek.every((s) => s.published),
    totalHours: totalMinutes / 60,
    laborCost,
    issues: weekIssues,
    errorCount: weekIssues.filter((i) => i.severity === "error").length,
    warningCount: weekIssues.filter((i) => i.severity === "warning").length,
  };
}

export function formatHours(hours) {
  if (!hours) return "0h";
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (minutes === 0) return `${whole}h`;
  if (whole === 0) return `${minutes}m`;
  return `${whole}h ${minutes}m`;
}

export function formatDateLabel(iso, opts = {}) {
  return parseDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", ...opts });
}

export function formatRangeLabel(dates) {
  const first = parseDate(dates[0]);
  const last = parseDate(dates[dates.length - 1]);
  const month = (d) => d.toLocaleDateString(undefined, { month: "short" });
  const sameYear = first.getFullYear() === last.getFullYear();
  const sameMonth = sameYear && first.getMonth() === last.getMonth();

  // Built piece by piece: asking Intl for "day + year" without a month
  // produces things like "2026 (day: 27)" in some locales.
  if (sameMonth) {
    return `${month(first)} ${first.getDate()} – ${last.getDate()}, ${last.getFullYear()}`;
  }
  if (sameYear) {
    return `${month(first)} ${first.getDate()} – ${month(last)} ${last.getDate()}, ${last.getFullYear()}`;
  }
  return `${month(first)} ${first.getDate()}, ${first.getFullYear()} – ${month(last)} ${last.getDate()}, ${last.getFullYear()}`;
}
