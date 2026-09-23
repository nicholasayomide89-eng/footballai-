import type { LiveDelta, LiveSession } from "@/types/analytics";

/** Merge an incremental update into a session (pure; safe for React state). */
export function applyDelta(session: LiveSession, d: LiveDelta): LiveSession {
  if (d.liveId !== session.id) return session;
  let next = session;

  if (d.point) {
    const series = next.series.filter((p) => p.minute !== d.point!.minute);
    series.push(d.point);
    series.sort((a, b) => a.minute - b.minute);
    next = { ...next, series };
  }
  if (d.comments?.length) {
    const ids = new Set(next.comments.map((c) => c.id));
    const fresh = d.comments.filter((c) => !ids.has(c.id));
    if (fresh.length) next = { ...next, comments: [...next.comments, ...fresh] };
  }
  if (d.viewersUpserted?.length) {
    const byId = new Map(next.viewers.map((v) => [v.id, v]));
    for (const v of d.viewersUpserted) byId.set(v.id, v);
    next = { ...next, viewers: [...byId.values()] };
  }
  if (d.guestsUpserted?.length) {
    const byId = new Map(next.guests.map((g) => [g.id, g]));
    for (const g of d.guestsUpserted) byId.set(g.id, g);
    next = { ...next, guests: [...byId.values()] };
  }
  if (d.events?.length) {
    const ids = new Set(next.sourceEvents.map((e) => e.id));
    next = { ...next, sourceEvents: [...next.sourceEvents, ...d.events.filter((e) => !ids.has(e.id))] };
  }
  if (d.status) {
    next = {
      ...next,
      status: d.status,
      endedAt: d.endedAt ?? next.endedAt,
      // Anyone still watching or on screen leaves when the broadcast ends.
      viewers: d.status === "ended" ? next.viewers.map((v) => (v.leftMinute === null ? { ...v, leftMinute: next.series.length } : v)) : next.viewers,
      guests: d.status === "ended" ? next.guests.map((g) => (g.leftMinute === null ? { ...g, leftMinute: next.series.length } : g)) : next.guests,
    };
  }
  return next;
}
