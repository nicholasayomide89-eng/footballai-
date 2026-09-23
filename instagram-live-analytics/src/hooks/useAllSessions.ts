import { useEffect, useState } from "react";
import type { LiveSession } from "@/types/analytics";
import { useDashboard } from "@/state/DashboardContext";

/** Loads full data for the given Lives (defaults to every previous Live). */
export function useSessions(ids?: string[]) {
  const { previousLives, loadSession } = useDashboard();
  const wanted = ids ?? previousLives.map((l) => l.id);
  const key = wanted.join(",");
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(wanted.map((id) => loadSession(id)))
      .then((s) => !cancelled && setSessions(s))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loadSession]);

  return { sessions, loading };
}
