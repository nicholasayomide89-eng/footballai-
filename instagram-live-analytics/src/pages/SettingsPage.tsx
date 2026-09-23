import clsx from "clsx";
import { RotateCcw } from "lucide-react";
import { useDashboard, DEFAULT_KEYWORDS } from "@/state/DashboardContext";
import { AVAILABILITY_META } from "@/services/capabilities";
import { Button, Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/primitives";
import { AvailabilityLegend, AVAILABILITY_ICON, AVAILABILITY_TONE } from "@/components/ui/AvailabilityBadge";

export function SettingsPage() {
  const { sourceLabel, sourceKind, capabilityList, restartDemo, keywords, setKeywords } = useDashboard();

  return (
    <div className="space-y-6">
      <SectionTitle title="Settings" subtitle="Data sources, metric availability and preferences." />

      <Card>
        <CardHeader title="Data source" subtitle="Where the dashboard reads its data from" />
        <CardBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">{sourceLabel}</p>
              <p className="mt-0.5 text-[13px] text-ink-muted">
                {sourceKind === "mock"
                  ? "Realistic sample data for a fictional creator account. The current Live replays at 12× speed so live charts can be tested."
                  : "Connected to a live data source."}
              </p>
            </div>
            {sourceKind === "mock" && (
              <Button onClick={restartDemo}>
                <RotateCcw className="h-4 w-4" /> Restart demo Live
              </Button>
            )}
          </div>
          <div className="mt-5 grid gap-3 text-[13px] md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Official Meta / Instagram APIs", "Instagram Graph API for live media and live comments. Run calls from a backend; never ship tokens to the browser.", "MetaGraphDataSource"],
              ["Webhooks", "Receive Meta’s live_comments webhook on your server and stream it to the dashboard.", "HttpBackendDataSource (SSE)"],
              ["Approved third-party services", "Plug an authorized analytics provider into your backend to fill metrics Meta doesn’t expose.", "HttpBackendDataSource"],
              ["Custom backend", "Your API merges all sources plus manual imports and exposes the typed endpoints.", "HttpBackendDataSource"],
            ].map(([t, d, c]) => (
              <div key={t} className="rounded-xl border border-line p-3">
                <p className="font-medium text-ink">{t}</p>
                <p className="mt-1 text-ink-muted">{d}</p>
                <code className="mt-2 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] text-ink-soft">{c}</code>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Metric availability" subtitle="What an official Meta integration can actually provide. Demo mode fills everything with sample data; these labels show what would be real." />
        <CardBody>
          <div className="mb-4">
            <AvailabilityLegend />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium text-ink-muted">
                  <th className="py-2 pr-4">Metric</th>
                  <th className="py-2 pr-4">Availability</th>
                  <th className="py-2">Source & limits</th>
                </tr>
              </thead>
              <tbody>
                {capabilityList.map((c) => {
                  const Icon = AVAILABILITY_ICON[c.availability];
                  return (
                    <tr key={c.key} className="border-b border-line/60 last:border-0 align-top">
                      <td className="py-2.5 pr-4 font-medium text-ink">{c.label}</td>
                      <td className="py-2.5 pr-4">
                        <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium", AVAILABILITY_TONE[c.availability])}>
                          <Icon className="h-3.5 w-3.5" /> {AVAILABILITY_META[c.availability].label}
                        </span>
                      </td>
                      <td className="py-2.5 text-[13px] text-ink-muted">{c.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-ink-muted">
            Meta changes its APIs regularly. Re-check the current Instagram Graph API documentation before relying on any of these in production, and update <code>src/services/capabilities.ts</code>.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Comment keywords" subtitle="Highlighted in the comment feed and counted under Keyword detection" />
        <CardBody>
          <p className="text-sm text-ink-soft">{keywords.join(", ") || "None"}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => setKeywords(DEFAULT_KEYWORDS)}>
              Reset to defaults
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
