// Time-off requests: approve, deny, or log leave on someone's behalf.

import { el, icon, initials, contrastText, confirmDialog, toast } from "../dom.js";
import { setTimeOffStatus, removeTimeOff } from "../store.js";
import { openTimeOffEditor } from "../modals.js";
import { formatDateLabel, dayIndex, todayISO } from "../scheduling.js";

const STATUS_LABEL = { pending: "Pending", approved: "Approved", denied: "Denied" };

function lengthLabel(request) {
  const days = dayIndex(request.endDate) - dayIndex(request.startDate) + 1;
  return days === 1 ? "1 day" : `${days} days`;
}

export function renderTimeOff(state) {
  const today = dayIndex(todayISO());
  const requests = [...state.timeOff].sort((a, b) => {
    const rank = { pending: 0, approved: 1, denied: 2 };
    return rank[a.status] - rank[b.status] || dayIndex(a.startDate) - dayIndex(b.startDate);
  });

  const rows = requests.map((request) => {
    const employee = state.employees.find((e) => e.id === request.employeeId);
    const past = dayIndex(request.endDate) < today;

    return el("article.request", { class: `request request--${request.status}${past ? " request--past" : ""}` }, [
      el("span.avatar", { style: { background: employee?.color || "#94a3b8", color: contrastText(employee?.color) } }, initials(employee?.name || "?")),
      el("div.request__main", {}, [
        el("div.request__who", {}, [
          employee?.name || "Removed employee",
          el("span.pill", { class: `pill pill--${request.status}` }, STATUS_LABEL[request.status] || request.status),
          past ? el("span.pill", {}, "Past") : null,
        ]),
        el("div.request__when", {}, [
          icon("calendar"),
          el("span", {}, `${formatDateLabel(request.startDate, { weekday: "short", year: "numeric" })} → ${formatDateLabel(request.endDate, { weekday: "short", year: "numeric" })}`),
          el("span.request__len", {}, lengthLabel(request)),
        ]),
        el("div.request__why", {}, [request.reason, request.note ? el("span.request__note", {}, ` — ${request.note}`) : null]),
      ]),
      el("div.request__actions", {}, [
        request.status !== "approved"
          ? el("button.btn.btn--ghost", { type: "button", onclick: () => { setTimeOffStatus(request.id, "approved"); toast("Request approved — matching shifts are now flagged."); } }, [icon("check"), el("span", {}, "Approve")])
          : null,
        request.status !== "denied"
          ? el("button.btn.btn--ghost", { type: "button", onclick: () => { setTimeOffStatus(request.id, "denied"); toast("Request denied."); } }, [icon("close"), el("span", {}, "Deny")])
          : null,
        el("button.icon-btn", { type: "button", "aria-label": "Edit request", onclick: () => openTimeOffEditor(request.id) }, icon("settings")),
        el("button.icon-btn", { type: "button", "aria-label": "Delete request", onclick: () => {
          if (confirmDialog("Delete this request?")) { removeTimeOff(request.id); toast("Request deleted."); }
        } }, icon("trash")),
      ]),
    ]);
  });

  const pending = requests.filter((r) => r.status === "pending").length;

  return el("section.view", {}, [
    el("div.view__bar", {}, [
      el("div.view__title", {}, [
        el("h2", {}, "Time off"),
        el("p", {}, pending ? `${pending} request${pending === 1 ? "" : "s"} awaiting a decision` : "Nothing waiting on you"),
      ]),
      el("button.btn.btn--primary", { type: "button", onclick: () => openTimeOffEditor() }, [icon("plus"), el("span", {}, "Add request")]),
    ]),
    requests.length
      ? el("div.requests", {}, rows)
      : el("div.empty", {}, [
          icon("away"),
          el("h3", {}, "No time-off requests"),
          el("p", {}, "Approved leave blocks scheduling and shows up on the week grid."),
          el("button.btn.btn--primary", { type: "button", onclick: () => openTimeOffEditor() }, [icon("plus"), el("span", {}, "Add request")]),
        ]),
  ]);
}
