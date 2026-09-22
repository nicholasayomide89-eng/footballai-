import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTime,
  formatTime,
  toISODate,
  addDays,
  dayIndex,
  shiftSpan,
  shiftMinutes,
  crossesMidnight,
  overlaps,
  startOfWeek,
  weekDates,
  hoursForEmployee,
  timeOffOn,
  isWithinAvailability,
  detectConflicts,
  weekSummary,
  formatHours,
} from "../js/scheduling.js";

const shift = (over = {}) => ({
  id: over.id || Math.random().toString(36).slice(2),
  employeeId: "e1",
  date: "2026-09-21",
  start: "09:00",
  end: "17:00",
  breakMinutes: 0,
  published: false,
  ...over,
});

test("parseTime accepts valid clock times and rejects junk", () => {
  assert.equal(parseTime("09:30"), 570);
  assert.equal(parseTime("00:00"), 0);
  assert.equal(parseTime("24:00"), 1440);
  assert.ok(Number.isNaN(parseTime("24:30")));
  assert.ok(Number.isNaN(parseTime("9:3")));
  assert.ok(Number.isNaN(parseTime("")));
});

test("formatTime round-trips and renders 12-hour clocks", () => {
  assert.equal(formatTime(570), "09:30");
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(570, true), "9:30 AM");
  assert.equal(formatTime(720, true), "12:00 PM");
  assert.equal(formatTime(0, true), "12:00 AM");
  assert.equal(formatTime(1380, true), "11:00 PM");
});

test("date helpers stay in local time across month ends", () => {
  assert.equal(addDays("2026-09-30", 1), "2026-10-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(toISODate(new Date(2026, 8, 22)), "2026-09-22");
  assert.equal(dayIndex("2026-09-22") - dayIndex("2026-09-21"), 1);
});

test("shiftMinutes subtracts the unpaid break", () => {
  assert.equal(shiftMinutes(shift()), 480);
  assert.equal(shiftMinutes(shift({ breakMinutes: 30 })), 450);
});

test("overnight shifts roll into the next day", () => {
  const night = shift({ start: "22:00", end: "06:00" });
  assert.equal(crossesMidnight(night), true);
  assert.equal(shiftMinutes(night), 480);
  const span = shiftSpan(night);
  assert.equal(span.end - span.start, 480);
});

test("overlap is half-open so back-to-back shifts are fine", () => {
  const morning = shiftSpan(shift({ start: "09:00", end: "17:00" }));
  const evening = shiftSpan(shift({ start: "17:00", end: "21:00" }));
  const late = shiftSpan(shift({ start: "16:00", end: "21:00" }));
  assert.equal(overlaps(morning, evening), false);
  assert.equal(overlaps(morning, late), true);
});

test("weeks can start on Monday or Sunday", () => {
  assert.equal(startOfWeek("2026-09-24", 1), "2026-09-21");
  assert.equal(startOfWeek("2026-09-24", 0), "2026-09-20");
  assert.equal(startOfWeek("2026-09-21", 1), "2026-09-21");
  const week = weekDates("2026-09-24", 1);
  assert.equal(week.length, 7);
  assert.equal(week[0], "2026-09-21");
  assert.equal(week[6], "2026-09-27");
});

test("hours are summed only for the requested dates", () => {
  const shifts = [
    shift({ date: "2026-09-21" }),
    shift({ date: "2026-09-22", breakMinutes: 60 }),
    shift({ date: "2026-09-28" }),
    shift({ date: "2026-09-22", employeeId: "e2" }),
  ];
  assert.equal(hoursForEmployee(shifts, "e1", weekDates("2026-09-22", 1)), 15);
});

test("only approved time off blocks a date", () => {
  const timeOff = [
    { id: "t1", employeeId: "e1", startDate: "2026-09-21", endDate: "2026-09-23", status: "approved", reason: "Vacation" },
    { id: "t2", employeeId: "e2", startDate: "2026-09-21", endDate: "2026-09-21", status: "pending", reason: "Appointment" },
  ];
  assert.equal(timeOffOn(timeOff, "e1", "2026-09-22").reason, "Vacation");
  assert.equal(timeOffOn(timeOff, "e1", "2026-09-24"), null);
  assert.equal(timeOffOn(timeOff, "e2", "2026-09-21"), null);
});

test("availability windows must fully cover the shift", () => {
  // 2026-09-21 is a Monday (day 1), 2026-09-22 a Tuesday (day 2).
  const employee = { id: "e1", availability: { 1: [{ start: "08:00", end: "16:00" }], 2: [{ start: "00:00", end: "08:00" }], 3: [] } };
  assert.equal(isWithinAvailability(employee, shift({ start: "09:00", end: "15:00" })), true);
  assert.equal(isWithinAvailability(employee, shift({ start: "09:00", end: "18:00" })), false);
  assert.equal(isWithinAvailability(employee, shift({ date: "2026-09-23", start: "09:00", end: "12:00" })), false);
  assert.equal(isWithinAvailability({ id: "e1" }, shift()), true, "no availability map means always available");
});

test("an overnight shift checks both days of availability", () => {
  const employee = { id: "e1", availability: { 1: [{ start: "20:00", end: "24:00" }], 2: [{ start: "00:00", end: "08:00" }] } };
  assert.equal(isWithinAvailability(employee, shift({ start: "22:00", end: "06:00" })), true);
  assert.equal(isWithinAvailability(employee, shift({ start: "22:00", end: "09:00" })), false);
});

test("detectConflicts flags double-booking, leave and open shifts", () => {
  const employees = [{ id: "e1", name: "Ada", maxHoursPerWeek: 40 }];
  const shifts = [
    shift({ id: "s1", start: "09:00", end: "17:00" }),
    shift({ id: "s2", start: "16:00", end: "20:00" }),
    shift({ id: "s3", employeeId: null }),
  ];
  const timeOff = [{ id: "t1", employeeId: "e1", startDate: "2026-09-21", endDate: "2026-09-21", status: "approved", reason: "Sick" }];
  const issues = detectConflicts({ shifts, employees, timeOff, settings: { minRestHours: 8 } });
  const types = issues.map((i) => i.type);
  assert.ok(types.includes("overlap"));
  assert.ok(types.includes("timeOff"));
  assert.ok(types.includes("unassigned"));
  assert.equal(issues.find((i) => i.type === "overlap").shiftId, "s2");
});

test("detectConflicts flags short rest but not a full night off", () => {
  const employees = [{ id: "e1", name: "Ada" }];
  const tight = detectConflicts({
    shifts: [shift({ id: "s1", start: "14:00", end: "23:00" }), shift({ id: "s2", date: "2026-09-22", start: "06:00", end: "14:00" })],
    employees,
    settings: { minRestHours: 8 },
  });
  assert.equal(tight.filter((i) => i.type === "rest").length, 1);

  const roomy = detectConflicts({
    shifts: [shift({ id: "s1", start: "09:00", end: "17:00" }), shift({ id: "s2", date: "2026-09-22", start: "09:00", end: "17:00" })],
    employees,
    settings: { minRestHours: 8 },
  });
  assert.equal(roomy.filter((i) => i.type === "rest").length, 0);
});

test("weekly caps and minimums are reported per employee", () => {
  const employees = [
    { id: "e1", name: "Ada", maxHoursPerWeek: 20 },
    { id: "e2", name: "Grace", minHoursPerWeek: 30 },
  ];
  const shifts = [0, 1, 2, 3].map((i) =>
    shift({ id: `a${i}`, date: addDays("2026-09-21", i), start: "09:00", end: "17:00" })
  );
  shifts.push(shift({ id: "b1", employeeId: "e2", start: "09:00", end: "17:00" }));
  const issues = detectConflicts({ shifts, employees, settings: { weekStart: 1 } });
  const overtime = issues.find((i) => i.type === "overtime");
  const short = issues.find((i) => i.type === "understaffed");
  assert.equal(overtime.employeeId, "e1");
  assert.match(overtime.message, /32.0h/);
  assert.equal(short.employeeId, "e2");
});

test("invalid shift times are reported once and not double-counted", () => {
  const issues = detectConflicts({
    shifts: [shift({ id: "bad", start: "oops", end: "17:00" })],
    employees: [{ id: "e1", name: "Ada" }],
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, "invalid");
});

test("weekSummary totals hours, cost and open shifts for the week", () => {
  const employees = [{ id: "e1", name: "Ada", hourlyRate: 20 }];
  const dates = weekDates("2026-09-22", 1);
  const shifts = [
    shift({ id: "s1", date: "2026-09-21", published: true }),
    shift({ id: "s2", date: "2026-09-22", employeeId: null, published: true }),
    shift({ id: "s3", date: "2026-10-05" }),
  ];
  const summary = weekSummary({ shifts, employees, timeOff: [], settings: { weekStart: 1 }, dates });
  assert.equal(summary.shiftCount, 2);
  assert.equal(summary.openShifts, 1);
  assert.equal(summary.totalHours, 16);
  assert.equal(summary.laborCost, 160);
  assert.equal(summary.published, true);
});

test("formatHours renders friendly durations", () => {
  assert.equal(formatHours(0), "0h");
  assert.equal(formatHours(8), "8h");
  assert.equal(formatHours(7.5), "7h 30m");
  assert.equal(formatHours(0.25), "15m");
});

test("formatRangeLabel handles same month, month rollover and year rollover", async () => {
  const { formatRangeLabel, weekDates } = await import("../js/scheduling.js");
  assert.equal(formatRangeLabel(weekDates("2026-09-22", 1)), "Sep 21 – 27, 2026");
  assert.equal(formatRangeLabel(weekDates("2026-09-29", 1)), "Sep 28 – Oct 4, 2026");
  assert.equal(formatRangeLabel(weekDates("2025-12-30", 1)), "Dec 29, 2025 – Jan 4, 2026");
});
