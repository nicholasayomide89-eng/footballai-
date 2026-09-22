// Application state: a single immutable-ish object, persisted to localStorage,
// with a tiny subscribe/notify loop driving re-renders.

import { todayISO, addDays, startOfWeek, weekDates } from "./scheduling.js";

const STORAGE_KEY = "shiftly.v1";
const SCHEMA_VERSION = 1;

export const ROLE_PRESETS = ["Manager", "Shift lead", "Barista", "Server", "Cook", "Cashier", "Support", "Nurse", "Driver"];

export const PALETTE = [
  "#6366f1", "#0ea5e9", "#14b8a6", "#f59e0b",
  "#ec4899", "#8b5cf6", "#10b981", "#ef4444",
  "#0891b2", "#d946ef",
];

let uidCounter = 0;
export function uid(prefix = "id") {
  uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${uidCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const FULL_DAY = [{ start: "06:00", end: "22:00" }];
const availability = (days, windows = FULL_DAY) => {
  const map = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const d of days) map[d] = windows.map((w) => ({ ...w }));
  return map;
};

/** Demo roster + a week of shifts so the app is never an empty grid on first run. */
function seedData() {
  const monday = startOfWeek(todayISO(), 1);
  const employees = [
    { id: "emp_ada", name: "Ada Okonkwo", role: "Manager", email: "ada@northside.example", phone: "555-0110", color: PALETTE[0], hourlyRate: 32, maxHoursPerWeek: 40, minHoursPerWeek: 32, active: true, availability: availability([1, 2, 3, 4, 5], [{ start: "07:00", end: "19:00" }]) },
    { id: "emp_ben", name: "Ben Marquez", role: "Shift lead", email: "ben@northside.example", phone: "555-0111", color: PALETTE[1], hourlyRate: 26, maxHoursPerWeek: 40, minHoursPerWeek: 24, active: true, availability: availability([1, 2, 3, 4, 5, 6], [{ start: "06:00", end: "23:00" }]) },
    { id: "emp_chi", name: "Chiara Rossi", role: "Barista", email: "chiara@northside.example", phone: "555-0112", color: PALETTE[2], hourlyRate: 19, maxHoursPerWeek: 30, minHoursPerWeek: 12, active: true, availability: availability([0, 4, 5, 6], [{ start: "06:00", end: "16:00" }]) },
    { id: "emp_dev", name: "Devon Clarke", role: "Barista", email: "devon@northside.example", phone: "555-0113", color: PALETTE[3], hourlyRate: 19, maxHoursPerWeek: 25, minHoursPerWeek: 10, active: true, availability: availability([1, 3, 5, 6], [{ start: "12:00", end: "23:00" }]) },
    { id: "emp_eve", name: "Eve Nakamura", role: "Cook", email: "eve@northside.example", phone: "555-0114", color: PALETTE[4], hourlyRate: 24, maxHoursPerWeek: 40, minHoursPerWeek: 30, active: true, availability: availability([0, 1, 2, 3, 4, 5, 6], [{ start: "05:00", end: "22:00" }]) },
    { id: "emp_far", name: "Farid Haddad", role: "Cashier", email: "farid@northside.example", phone: "555-0115", color: PALETTE[5], hourlyRate: 18, maxHoursPerWeek: 20, minHoursPerWeek: 8, active: true, availability: availability([2, 3, 4, 0], [{ start: "08:00", end: "18:00" }]) },
  ];

  const plan = [
    ["emp_ada", 0, "08:00", "16:00", "Manager"], ["emp_ada", 1, "08:00", "16:00", "Manager"],
    ["emp_ada", 2, "08:00", "16:00", "Manager"], ["emp_ada", 3, "08:00", "16:00", "Manager"],
    ["emp_ben", 0, "06:00", "14:00", "Shift lead"], ["emp_ben", 1, "14:00", "22:00", "Shift lead"],
    ["emp_ben", 4, "06:00", "14:00", "Shift lead"], ["emp_ben", 5, "10:00", "18:00", "Shift lead"],
    ["emp_chi", 4, "06:00", "12:00", "Barista"], ["emp_chi", 5, "07:00", "15:00", "Barista"],
    ["emp_chi", 6, "07:00", "15:00", "Barista"],
    ["emp_dev", 0, "13:00", "21:00", "Barista"], ["emp_dev", 2, "13:00", "21:00", "Barista"],
    ["emp_dev", 4, "14:00", "22:00", "Barista"], ["emp_dev", 5, "14:00", "22:00", "Barista"],
    ["emp_eve", 1, "05:00", "13:00", "Cook"], ["emp_eve", 2, "05:00", "13:00", "Cook"],
    ["emp_eve", 3, "05:00", "13:00", "Cook"], ["emp_eve", 4, "05:00", "13:00", "Cook"],
    ["emp_eve", 5, "06:00", "14:00", "Cook"],
    ["emp_far", 1, "09:00", "14:00", "Cashier"], ["emp_far", 3, "09:00", "14:00", "Cashier"],
    [null, 6, "15:00", "21:00", "Barista"], [null, 2, "17:00", "22:00", "Cashier"],
  ];

  const shifts = plan.map(([employeeId, offset, start, end, role]) => ({
    id: uid("sh"),
    employeeId,
    date: addDays(monday, offset),
    start,
    end,
    role,
    location: "Northside Cafe",
    breakMinutes: 30,
    notes: "",
    published: true,
  }));

  const timeOff = [
    { id: uid("to"), employeeId: "emp_chi", startDate: addDays(monday, 9), endDate: addDays(monday, 13), reason: "Vacation", status: "approved", note: "Booked in March." },
    { id: uid("to"), employeeId: "emp_far", startDate: addDays(monday, 2), endDate: addDays(monday, 2), reason: "Medical appointment", status: "pending", note: "" },
  ];

  return { employees, shifts, timeOff };
}

export function defaultState() {
  const seeded = seedData();
  return {
    version: SCHEMA_VERSION,
    ...seeded,
    settings: {
      orgName: "Northside Cafe",
      weekStart: 1,
      overtimeThreshold: 40,
      minRestHours: 8,
      hour12: false,
      currency: "$",
      theme: "system",
      locations: ["Northside Cafe", "Airport Kiosk"],
      roles: ["Manager", "Shift lead", "Barista", "Cook", "Cashier"],
    },
    ui: {
      view: "schedule",
      anchorDate: todayISO(),
      roleFilter: "",
      locationFilter: "",
      search: "",
      showOnlyIssues: false,
    },
  };
}

function migrate(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    version: SCHEMA_VERSION,
    employees: Array.isArray(raw.employees) ? raw.employees : base.employees,
    shifts: Array.isArray(raw.shifts) ? raw.shifts : base.shifts,
    timeOff: Array.isArray(raw.timeOff) ? raw.timeOff : base.timeOff,
    settings: { ...base.settings, ...(raw.settings || {}) },
    // UI state is session-scoped: always reopen on the current week.
    ui: { ...base.ui, ...(raw.ui || {}), anchorDate: todayISO(), search: "" },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch (err) {
    console.warn("Could not read saved schedule, starting fresh.", err);
    return defaultState();
  }
}

let state = load();
const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Schedule could not be saved to this browser.", err);
  }
}

/** Apply a reducer-style update, save, then notify the UI. */
export function update(mutator, { persist: shouldPersist = true } = {}) {
  const next = mutator(state);
  if (next && next !== state) state = next;
  if (shouldPersist) persist();
  for (const fn of listeners) fn(state);
  return state;
}

export function setUI(patch) {
  return update((s) => ({ ...s, ui: { ...s.ui, ...patch } }), { persist: false });
}

export function setSettings(patch) {
  return update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

// ── Employees ────────────────────────────────────────────────────────────────

export function upsertEmployee(employee) {
  return update((s) => {
    const exists = s.employees.some((e) => e.id === employee.id);
    const employees = exists
      ? s.employees.map((e) => (e.id === employee.id ? { ...e, ...employee } : e))
      : [...s.employees, { id: uid("emp"), active: true, color: PALETTE[s.employees.length % PALETTE.length], ...employee }];
    return { ...s, employees };
  });
}

/** Removing someone leaves their shifts in place as open shifts to re-fill. */
export function removeEmployee(employeeId) {
  return update((s) => ({
    ...s,
    employees: s.employees.filter((e) => e.id !== employeeId),
    shifts: s.shifts.map((sh) => (sh.employeeId === employeeId ? { ...sh, employeeId: null, published: false } : sh)),
    timeOff: s.timeOff.filter((t) => t.employeeId !== employeeId),
  }));
}

// ── Shifts ───────────────────────────────────────────────────────────────────

export function upsertShift(shift) {
  return update((s) => {
    const exists = shift.id && s.shifts.some((sh) => sh.id === shift.id);
    const shifts = exists
      ? s.shifts.map((sh) => (sh.id === shift.id ? { ...sh, ...shift } : sh))
      : [...s.shifts, { id: uid("sh"), breakMinutes: 0, published: false, notes: "", ...shift }];
    return { ...s, shifts };
  });
}

export function removeShift(shiftId) {
  return update((s) => ({ ...s, shifts: s.shifts.filter((sh) => sh.id !== shiftId) }));
}

export function moveShift(shiftId, { date, employeeId }) {
  return update((s) => ({
    ...s,
    shifts: s.shifts.map((sh) =>
      sh.id === shiftId
        ? { ...sh, date: date ?? sh.date, employeeId: employeeId === undefined ? sh.employeeId : employeeId, published: false }
        : sh
    ),
  }));
}

export function duplicateShift(shiftId) {
  return update((s) => {
    const original = s.shifts.find((sh) => sh.id === shiftId);
    if (!original) return s;
    return { ...s, shifts: [...s.shifts, { ...original, id: uid("sh"), published: false }] };
  });
}

export function publishWeek(dates, published = true) {
  const set = new Set(dates);
  return update((s) => ({
    ...s,
    shifts: s.shifts.map((sh) => (set.has(sh.date) ? { ...sh, published } : sh)),
  }));
}

export function clearWeek(dates) {
  const set = new Set(dates);
  return update((s) => ({ ...s, shifts: s.shifts.filter((sh) => !set.has(sh.date)) }));
}

/**
 * Copy the previous week's shifts forward, skipping days that already have
 * shifts so a partially built week is never clobbered.
 */
export function copyPreviousWeek(dates) {
  return update((s) => {
    const target = new Set(dates);
    const sourceDates = dates.map((d) => addDays(d, -7));
    const occupied = new Set(s.shifts.filter((sh) => target.has(sh.date)).map((sh) => sh.date));
    const copies = s.shifts
      .filter((sh) => sourceDates.includes(sh.date))
      .map((sh) => ({ ...sh, id: uid("sh"), date: addDays(sh.date, 7), published: false }))
      .filter((sh) => !occupied.has(sh.date));
    return { ...s, shifts: [...s.shifts, ...copies] };
  });
}

// ── Time off ─────────────────────────────────────────────────────────────────

export function upsertTimeOff(request) {
  return update((s) => {
    const exists = request.id && s.timeOff.some((t) => t.id === request.id);
    const timeOff = exists
      ? s.timeOff.map((t) => (t.id === request.id ? { ...t, ...request } : t))
      : [...s.timeOff, { id: uid("to"), status: "pending", note: "", ...request }];
    return { ...s, timeOff };
  });
}

export function setTimeOffStatus(id, status) {
  return update((s) => ({ ...s, timeOff: s.timeOff.map((t) => (t.id === id ? { ...t, status } : t)) }));
}

export function removeTimeOff(id) {
  return update((s) => ({ ...s, timeOff: s.timeOff.filter((t) => t.id !== id) }));
}

// ── Whole-dataset operations ─────────────────────────────────────────────────

export function replaceAll(data) {
  return update(() => migrate(data));
}

export function resetToDemo() {
  return update(() => defaultState());
}

export function clearEverything() {
  return update((s) => ({ ...s, employees: [], shifts: [], timeOff: [] }));
}

export function exportJSON() {
  const { ui, ...rest } = state;
  return JSON.stringify(rest, null, 2);
}

export function currentWeekDates(s = state) {
  return weekDates(s.ui.anchorDate, s.settings.weekStart);
}
