import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  ClipOpportunity,
  EngagementMoment,
  GuestAnalytics,
  LiveEvent,
  LiveOverviewStats,
  LiveSession,
  LiveSummary,
  MetricCapability,
  MetricKey,
} from "@/types/analytics";
import { getDataService } from "@/services";
import { capabilityMap } from "@/services/capabilities";
import { buildClipOpportunities, buildTimeline, computeOverview, detectMoments, guestAnalytics } from "@/lib/analytics";
import { applyDelta } from "./applyDelta";

export const DEFAULT_KEYWORDS = ["price", "mic", "camera", "template", "giveaway", "link", "collab", "portfolio", "client"];

interface DashboardState {
  sourceLabel: string;
  sourceKind: string;
  capabilities: Record<MetricKey, MetricCapability>;
  capabilityList: MetricCapability[];

  currentLiveId: string | null;
  activeLiveId: string | null;
  setActiveLiveId: (id: string) => void;

  session: LiveSession | null;
  loading: boolean;
  error: string | null;
  liveViewers: number | null;
  now: number;

  overview: LiveOverviewStats | null;
  moments: EngagementMoment[];
  clips: ClipOpportunity[];
  timeline: LiveEvent[];
  guests: GuestAnalytics[];

  previousLives: LiveSummary[];
  loadSession: (id: string) => Promise<LiveSession>;

  togglePin: (commentId: string) => void;
  toggleFlag: (commentId: string) => void;
  toggleClipMark: (clipId: string) => void;

  keywords: string[];
  setKeywords: (k: string[]) => void;
  restartDemo: () => void;
}

const Ctx = createContext<DashboardState | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0); // bump to reload everything
  const service = useMemo(() => getDataService(), []);
  const capabilityList = useMemo(() => service.getCapabilities(), [service]);
  const capabilities = useMemo(() => capabilityMap(capabilityList), [capabilityList]);

  const [currentLiveId, setCurrentLiveId] = useState<string | null>(null);
  const [activeLiveId, setActiveLiveId] = useState<string | null>(null);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveViewers, setLiveViewers] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [previousLives, setPreviousLives] = useState<LiveSummary[]>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [keywords, setKeywords] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("livelens-keywords");
      return raw ? JSON.parse(raw) : DEFAULT_KEYWORDS;
    } catch {
      return DEFAULT_KEYWORDS;
    }
  });
  const cache = useRef(new Map<string, LiveSession>());

  useEffect(() => {
    try {
      localStorage.setItem("livelens-keywords", JSON.stringify(keywords));
    } catch {
      /* ignore */
    }
  }, [keywords]);

  // Bootstrap: current Live + history
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cache.current.clear();
    Promise.all([service.getCurrentLive(), service.listPreviousLives()])
      .then(([current, history]) => {
        if (cancelled) return;
        setPreviousLives(history);
        const id = current?.id ?? history[0]?.id ?? null;
        setCurrentLiveId(current?.status === "live" ? current.id : null);
        setActiveLiveId(id);
        if (current) setSession(current);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [service, version]);

  // Load the active Live when it changes
  useEffect(() => {
    if (!activeLiveId || session?.id === activeLiveId) return;
    let cancelled = false;
    setLoading(true);
    service
      .getLive(activeLiveId)
      .then((s) => !cancelled && setSession(s))
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLiveId, service]);

  // Stream updates for the running Live
  useEffect(() => {
    if (!session || session.status !== "live" || session.id !== activeLiveId) return;
    setLiveViewers(null);
    return service.subscribeToLive(session.id, (d) => {
      setSession((s) => (s ? applyDelta(s, d) : s));
      if (d.currentViewers !== undefined) setLiveViewers(d.currentViewers);
      if (d.serverTime) setNow(new Date(d.serverTime).getTime());
      if (d.status === "ended") {
        setCurrentLiveId(null);
        service.listPreviousLives().then(setPreviousLives);
      }
    });
    // Re-subscribe only when the Live identity or status changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.status, activeLiveId, service]);

  // Marked clips for the active Live
  useEffect(() => {
    if (!activeLiveId) return;
    service.getMarkedClips(activeLiveId).then((ids) => setMarked(new Set(ids)));
  }, [activeLiveId, service, version]);

  const minuteCount = session?.series.length ?? 0;
  const commentCount = session?.comments.length ?? 0;
  const moments = useMemo(
    () => (session ? detectMoments(session) : []),
    // Recompute once per completed minute (or when the Live changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.id, minuteCount, session?.guests],
  );
  const clips = useMemo(() => (session ? buildClipOpportunities(session, moments, marked) : []), [session?.id, moments, marked]); // eslint-disable-line react-hooks/exhaustive-deps
  const timeline = useMemo(() => (session ? buildTimeline(session, moments) : []), [session?.id, session?.sourceEvents, moments]); // eslint-disable-line react-hooks/exhaustive-deps
  const guests = useMemo(() => (session ? guestAnalytics(session) : []), [session?.id, minuteCount, session?.guests, commentCount]); // eslint-disable-line react-hooks/exhaustive-deps
  const overview = useMemo(
    () => (session ? computeOverview(session, liveViewers ?? undefined, session.status === "live" ? now : undefined) : null),
    [session, liveViewers, now],
  );

  const loadSession = useCallback(
    async (id: string) => {
      const hit = cache.current.get(id);
      if (hit) return hit;
      const s = await service.getLive(id);
      if (s.status === "ended") cache.current.set(id, s);
      return s;
    },
    [service],
  );

  const updateComment = useCallback(
    (commentId: string, patch: (c: LiveSession["comments"][number]) => Partial<LiveSession["comments"][number]>) => {
      setSession((s) => {
        if (!s) return s;
        const c = s.comments.find((x) => x.id === commentId);
        if (!c) return s;
        const p = patch(c);
        if ("pinned" in p) service.setCommentPinned(s.id, commentId, Boolean(p.pinned));
        if ("flagged" in p) service.setCommentFlagged(s.id, commentId, Boolean(p.flagged), p.flagReason);
        return { ...s, comments: s.comments.map((x) => (x.id === commentId ? { ...x, ...p } : x)) };
      });
    },
    [service],
  );

  const value: DashboardState = {
    sourceLabel: service.label,
    sourceKind: service.kind,
    capabilities,
    capabilityList,
    currentLiveId,
    activeLiveId,
    setActiveLiveId,
    session,
    loading,
    error,
    liveViewers,
    now,
    overview,
    moments,
    clips,
    timeline,
    guests,
    previousLives,
    loadSession,
    togglePin: (id) => updateComment(id, (c) => ({ pinned: !c.pinned })),
    toggleFlag: (id) => updateComment(id, (c) => ({ flagged: !c.flagged, flagReason: c.flagged ? undefined : "Flagged by you" })),
    toggleClipMark: (clipId) => {
      if (!activeLiveId) return;
      setMarked((prev) => {
        const next = new Set(prev);
        const on = !next.has(clipId);
        if (on) next.add(clipId);
        else next.delete(clipId);
        service.setClipMarked(activeLiveId, clipId, on);
        return next;
      });
    },
    keywords,
    setKeywords,
    restartDemo: () => {
      const s = service as unknown as { reset?: () => void };
      s.reset?.();
      setSession(null);
      setActiveLiveId(null);
      setVersion((v) => v + 1);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboard() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDashboard must be used inside DashboardProvider");
  return v;
}
