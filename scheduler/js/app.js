// App shell: chrome, navigation, week controls, and the render loop.

import { el, mount, icon, $, toast } from "./dom.js";
import { getState, subscribe, setUI, setSettings, currentWeekDates } from "./store.js";
import { openSettings, openShiftEditor, openEmployeeEditor } from "./modals.js";
import { renderSchedule } from "./views/schedule.js";
import { renderPeople } from "./views/people.js";
import { renderTimeOff } from "./views/timeoff.js";
import { renderReports } from "./views/reports.js";
import { downloadCSV } from "./export.js";
import { addDays, todayISO, formatRangeLabel, startOfWeek } from "./scheduling.js";

const VIEWS = [
  { id: "schedule", label: "Schedule", icon: "calendar", render: renderSchedule },
  { id: "people", label: "Team", icon: "users", render: renderPeople },
  { id: "timeoff", label: "Time off", icon: "away", render: renderTimeOff },
  { id: "reports", label: "Reports", icon: "chart", render: renderReports },
];

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

function nextTheme(current) {
  return current === "dark" ? "light" : current === "light" ? "system" : "dark";
}

function renderHeader(state) {
  const dates = currentWeekDates(state);
  const isThisWeek = dates[0] === startOfWeek(todayISO(), state.settings.weekStart);
  const pendingTimeOff = state.timeOff.filter((t) => t.status === "pending").length;

  const shiftWeek = (delta) => setUI({ anchorDate: addDays(state.ui.anchorDate, delta * 7) });

  return el("header.topbar", {}, [
    el("div.topbar__brand", {}, [
      el("span.logo", { "aria-hidden": "true" }, icon("calendar")),
      el("div", {}, [
        el("span.topbar__name", {}, "Shiftly"),
        el("span.topbar__org", {}, state.settings.orgName),
      ]),
    ]),

    el("nav.tabs", { "aria-label": "Sections" }, VIEWS.map((view) =>
      el("button.tab", {
        type: "button",
        class: state.ui.view === view.id ? "tab is-active" : "tab",
        "aria-current": state.ui.view === view.id ? "page" : null,
        onclick: () => setUI({ view: view.id }),
      }, [
        icon(view.icon),
        el("span", {}, view.label),
        view.id === "timeoff" && pendingTimeOff ? el("span.badge", {}, String(pendingTimeOff)) : null,
      ])
    )),

    el("div.topbar__actions", {}, [
      el("button.icon-btn", {
        type: "button",
        "aria-label": `Theme: ${state.settings.theme}. Click to change.`,
        title: `Theme: ${state.settings.theme}`,
        onclick: () => {
          const theme = nextTheme(state.settings.theme);
          setSettings({ theme });
          applyTheme(theme);
        },
      }, icon(state.settings.theme === "dark" ? "moon" : "sun")),
      el("button.icon-btn", { type: "button", "aria-label": "Settings", onclick: () => openSettings() }, icon("settings")),
      el("button.btn.btn--primary", { type: "button", onclick: () => openShiftEditor({ date: dates[0] }) }, [icon("plus"), el("span", {}, "New shift")]),
    ]),

    el("div.weekbar", {}, [
      el("div.weekbar__nav", {}, [
        el("button.icon-btn", { type: "button", "aria-label": "Previous week", onclick: () => shiftWeek(-1) }, icon("left")),
        el("button.btn.btn--ghost", { type: "button", disabled: isThisWeek, onclick: () => setUI({ anchorDate: todayISO() }) }, el("span", {}, "Today")),
        el("button.icon-btn", { type: "button", "aria-label": "Next week", onclick: () => shiftWeek(1) }, icon("right")),
        el("h1.weekbar__label", {}, formatRangeLabel(dates)),
        isThisWeek ? el("span.pill.pill--now", {}, "This week") : null,
      ]),

      el("div.weekbar__filters", {}, [
        el("label.search", {}, [
          icon("search"),
          el("input.input.input--search", {
            type: "search",
            placeholder: "Search people…",
            value: state.ui.search,
            "aria-label": "Search people",
            oninput: (event) => setUI({ search: event.target.value }),
          }),
        ]),
        el("select.input.input--slim", {
          "aria-label": "Filter by role",
          value: state.ui.roleFilter,
          onchange: (event) => setUI({ roleFilter: event.target.value }),
        }, [
          el("option", { value: "", selected: !state.ui.roleFilter }, "All roles"),
          ...state.settings.roles.map((role) => el("option", { value: role, selected: state.ui.roleFilter === role }, role)),
        ]),
        el("select.input.input--slim", {
          "aria-label": "Filter by location",
          value: state.ui.locationFilter,
          onchange: (event) => setUI({ locationFilter: event.target.value }),
        }, [
          el("option", { value: "", selected: !state.ui.locationFilter }, "All locations"),
          ...state.settings.locations.map((loc) => el("option", { value: loc, selected: state.ui.locationFilter === loc }, loc)),
        ]),
        el("label.check", {}, [
          el("input", { type: "checkbox", checked: state.ui.showOnlyIssues, onchange: (event) => setUI({ showOnlyIssues: event.target.checked }) }),
          el("span", {}, "Only conflicts"),
        ]),
        el("button.icon-btn", { type: "button", "aria-label": "Export this week as CSV", title: "Export CSV", onclick: () => downloadCSV(state, dates) }, icon("download")),
        el("button.icon-btn", { type: "button", "aria-label": "Print schedule", title: "Print", onclick: () => window.print() }, icon("print")),
      ]),
    ]),
  ]);
}

function render(state) {
  const root = $("#app");
  const view = VIEWS.find((v) => v.id === state.ui.view) || VIEWS[0];
  const scroller = $(".grid-scroll");
  const scrollLeft = scroller ? scroller.scrollLeft : 0;
  const focusedSelector = document.activeElement?.classList?.contains("input--search") ? ".input--search" : null;

  mount(root, [
    renderHeader(state),
    el("main.main", { id: "main" }, view.render(state)),
    el("footer.footnote", {}, [
      el("span", {}, "Shiftly · data stays in this browser"),
      el("button.link", { type: "button", onclick: () => openSettings() }, "Export or import it"),
    ]),
  ]);

  const nextScroller = $(".grid-scroll");
  if (nextScroller && scrollLeft) nextScroller.scrollLeft = scrollLeft;
  if (focusedSelector) {
    const field = $(focusedSelector);
    if (field) {
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }
  }
}

function bindShortcuts() {
  document.addEventListener("keydown", (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
    const state = getState();

    switch (event.key) {
      case "ArrowLeft":
        setUI({ anchorDate: addDays(state.ui.anchorDate, -7) });
        break;
      case "ArrowRight":
        setUI({ anchorDate: addDays(state.ui.anchorDate, 7) });
        break;
      case "t":
      case "T":
        setUI({ anchorDate: todayISO() });
        break;
      case "n":
      case "N":
        event.preventDefault();
        openShiftEditor({ date: currentWeekDates(state)[0] });
        break;
      case "e":
      case "E":
        openEmployeeEditor();
        break;
      case "?":
        toast("← → change week · T today · N new shift · E new employee", "info");
        break;
      default:
        return;
    }
  });
}

export function start() {
  const state = getState();
  applyTheme(state.settings.theme);
  subscribe(render);
  bindShortcuts();
  render(state);
}
