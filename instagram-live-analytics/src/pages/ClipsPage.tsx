import { useMemo, useState } from "react";
import { Download, Scissors } from "lucide-react";
import { useDashboard } from "@/state/DashboardContext";
import { formatOffset } from "@/lib/format";
import { Button, Card, EmptyState, SectionTitle, SegmentedControl } from "@/components/ui/primitives";
import { ClipCard } from "@/components/clips/ClipCard";

export function ClipsPage() {
  const { session, clips, toggleClipMark } = useDashboard();
  const [view, setView] = useState<"all" | "marked">("all");
  const [sort, setSort] = useState<"score" | "time">("score");

  const shown = useMemo(() => {
    const list = view === "marked" ? clips.filter((c) => c.marked) : clips;
    return [...list].sort((a, b) => (sort === "score" ? b.score - a.score : a.startMinute - b.startMinute));
  }, [clips, view, sort]);
  const markedCount = clips.filter((c) => c.marked).length;

  const exportMarked = () => {
    const rows = clips.filter((c) => c.marked);
    const csv = [
      ["start", "end", "title", "caption", "estimated_seconds", "viewers", "spike_pct"].join(","),
      ...rows.map((c) => [formatOffset(c.startMinute), formatOffset(c.endMinute + 1), c.suggestedTitle, c.suggestedCaption, c.estimatedLengthSeconds, c.viewerCount, c.engagementSpikePct].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `clips-${session?.id ?? "live"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <SectionTitle
        title="Clip Opportunities"
        subtitle="High-engagement moments ranked for Reels and Shorts. Measured numbers come from the Live; titles and captions are generated suggestions."
        actions={
          <>
            <SegmentedControl ariaLabel="Show" value={view} onChange={setView} options={[{ value: "all", label: `All (${clips.length})` }, { value: "marked", label: `Marked (${markedCount})` }]} />
            <SegmentedControl ariaLabel="Sort" value={sort} onChange={setSort} options={[{ value: "score", label: "Top score" }, { value: "time", label: "Timeline" }]} />
            <Button size="sm" onClick={exportMarked} disabled={!markedCount}>
              <Download className="h-4 w-4" /> Export marked
            </Button>
          </>
        }
      />
      {shown.length ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((c) => (
            <ClipCard key={c.id} clip={c} onToggleMark={toggleClipMark} rank={sort === "score" && view === "all" ? clips.indexOf(c) + 1 : undefined} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<Scissors className="h-6 w-6" />} title={view === "marked" ? "No clips marked yet" : "No clip opportunities yet"}>
            {view === "marked" ? "Use “Mark for editing” on any clip to build your edit list." : "They appear as soon as a spike in viewers, comments, likes or follows is detected."}
          </EmptyState>
        </Card>
      )}
    </div>
  );
}
