import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { DashboardProvider, useDashboard } from "@/state/DashboardContext";
import { AppShell } from "@/components/layout/AppShell";
import { NAV, type PageId } from "@/components/layout/navigation";
import { OverviewPage } from "@/pages/OverviewPage";
import { MonitorPage } from "@/pages/MonitorPage";
import { AudiencePage } from "@/pages/AudiencePage";
import { CommentsPage } from "@/pages/CommentsPage";
import { GuestsPage } from "@/pages/GuestsPage";
import { EngagementPage } from "@/pages/EngagementPage";
import { ClipsPage } from "@/pages/ClipsPage";
import { PreviousLivesPage } from "@/pages/PreviousLivesPage";
import { ComparePage } from "@/pages/ComparePage";
import { InsightsPage } from "@/pages/InsightsPage";
import { SettingsPage } from "@/pages/SettingsPage";

function readHash(): PageId {
  const id = window.location.hash.replace(/^#\/?/, "") as PageId;
  return NAV.some((n) => n.id === id) ? id : "overview";
}

function Pages() {
  const [page, setPage] = useState<PageId>(readHash);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const { loading, session, error } = useDashboard();

  useEffect(() => {
    const onHash = () => setPage(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = useCallback((p: PageId) => {
    window.location.hash = `/${p}`;
    setPage(p);
    window.scrollTo({ top: 0 });
  }, []);

  const needsSession = !["previous", "compare", "insights", "settings"].includes(page);

  return (
    <AppShell page={page} onNavigate={navigate}>
      {error && <p className="mb-4 rounded-lg border border-line bg-surface p-3 text-sm text-[var(--status-critical)]">{error}</p>}
      {needsSession && !session ? (
        <div className="flex items-center gap-2 py-20 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> {loading ? "Loading Live data…" : "No Live selected."}
        </div>
      ) : (
        <>
          {page === "overview" && <OverviewPage onNavigate={navigate} />}
          {page === "monitor" && <MonitorPage />}
          {page === "audience" && <AudiencePage />}
          {page === "comments" && <CommentsPage />}
          {page === "guests" && <GuestsPage />}
          {page === "engagement" && <EngagementPage onNavigate={navigate} />}
          {page === "clips" && <ClipsPage />}
          {page === "previous" && <PreviousLivesPage onNavigate={navigate} compareIds={compareIds} setCompareIds={setCompareIds} />}
          {page === "compare" && <ComparePage compareIds={compareIds} setCompareIds={setCompareIds} />}
          {page === "insights" && <InsightsPage />}
          {page === "settings" && <SettingsPage />}
        </>
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <DashboardProvider>
      <Pages />
    </DashboardProvider>
  );
}
