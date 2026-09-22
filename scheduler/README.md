# Shiftly — employee scheduling

A weekly staff scheduler: build rotas on a drag-and-drop grid, catch
double-bookings and overtime before the schedule goes out, track time off, and
export hours for payroll.

No build step, no dependencies — plain HTML, CSS and ES modules.

## Run it

```bash
cd scheduler
npm start           # http://127.0.0.1:4173
```

`npm start` runs `serve.mjs`, a ~50-line static server built on `node:http`.
Any other static server works too (`python3 -m http.server`, `npx serve`, …).
Opening `index.html` straight off disk will *not* work: browsers block ES
module imports over `file://`.

## What it does

**Schedule** — the week grid, people down the side and days across the top.
Click an empty cell to add a shift, click a shift to edit it, drag a shift onto
another person or day to reassign it. Each row shows hours scheduled against
that person's weekly cap. Days someone isn't available are hatched; approved
time off is shaded.

**Conflict detection** — every edit is re-checked and anything questionable is
listed above the grid and badged on the shift itself:

| Check | Severity |
| --- | --- |
| Overlapping shifts for one person | blocking |
| Shift during approved time off | blocking |
| Missing or invalid times | blocking |
| Shift outside declared availability | warning |
| Less than the configured rest between shifts | warning |
| Over a person's weekly hour cap | warning |
| Under a person's weekly minimum | info |
| Unassigned (open) shift | info |

Nothing is ever blocked from being saved — the schedule tells you what is wrong
and lets you decide.

**Team** — roster with roles, contact details, pay rate, weekly minimum and
maximum hours, a colour, and a per-day availability window. Removing someone
turns their shifts into open shifts rather than deleting them.

**Time off** — requests with approve / deny. Only *approved* leave blocks
scheduling; pending requests are visible but don't flag anything.

**Reports** — hours and estimated cost per person, coverage per day, hours per
role, CSV export, and a print stylesheet that drops the chrome and prints just
the grid.

**Week tools** — publish / unpublish the whole week, copy last week forward
(skipping days that already have shifts), clear the week.

Keyboard: `←` `→` change week, `T` jump to today, `N` new shift, `E` new
employee, `?` shows the list.

## Where the data lives

In the browser, under `localStorage["shiftly.v1"]`. Nothing is sent anywhere —
there is no server beyond the static file host. Settings → Export JSON writes a
full backup; Import JSON restores one. First run seeds a demo cafe roster so the
grid isn't empty; Settings → Delete everything clears it.

Because storage is per-browser, this is a single-planner tool. Sharing a
schedule between managers would need a real backend — the state shape in
`js/store.js` is the natural thing to move server-side.

## Layout

```
scheduler/
├── index.html           entry point
├── styles.css           design tokens, light + dark, print
├── serve.mjs            dependency-free static server
├── js/
│   ├── scheduling.js    pure logic: time maths, conflicts, totals
│   ├── store.js         state, persistence, actions, demo seed
│   ├── dom.js           el() helper, icons, toasts
│   ├── modals.js        shift / employee / time-off / settings editors
│   ├── export.js        CSV
│   ├── app.js           shell, nav, render loop
│   └── views/           schedule, people, timeoff, reports
└── tests/               node --test, no deps
```

`js/scheduling.js` holds every rule and does no DOM or storage work, so it is
testable on its own:

```bash
npm test
```

## Notes on the tricky bits

- **Overnight shifts.** An end time at or before the start means the shift rolls
  into the next day (`22:00 → 06:00` is 8 hours, not −16). Overlap and rest
  checks work in absolute minutes since the epoch so this falls out naturally.
- **Dates never touch UTC.** `2026-09-22` is parsed to local midnight and
  formatted back by hand; `toISOString()` would shift the day for anyone west of
  Greenwich.
- **Overlap is half-open.** A shift ending at 17:00 and one starting at 17:00
  are back-to-back, not a double-booking.
- **Breaks are unpaid.** Paid hours are the clock span minus the break; the span
  is still what occupancy and rest checks use.
