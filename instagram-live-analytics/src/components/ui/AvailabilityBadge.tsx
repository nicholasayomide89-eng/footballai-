import clsx from "clsx";
import { useId, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, PenLine, Radio, Sigma } from "lucide-react";
import type { MetricAvailability, MetricKey } from "@/types/analytics";
import { AVAILABILITY_META } from "@/services/capabilities";
import { useDashboard } from "@/state/DashboardContext";

const ICON: Record<MetricAvailability, typeof Info> = {
  official_api: CheckCircle2,
  webhook: Radio,
  estimated: Sigma,
  manual_import: PenLine,
  third_party: Info,
  unsupported: AlertTriangle,
};

const TONE: Record<MetricAvailability, string> = {
  official_api: "text-[var(--status-good)]",
  webhook: "text-[var(--status-good)]",
  estimated: "text-[var(--status-warning)]",
  manual_import: "text-ink-muted",
  third_party: "text-ink-muted",
  unsupported: "text-[var(--status-critical)]",
};

/**
 * Small provenance marker shown next to every metric. Hover/focus explains
 * where the value would come from in production.
 */
export function AvailabilityBadge({ metric, compact = true }: { metric: MetricKey; compact?: boolean }) {
  const { capabilities } = useDashboard();
  const cap = capabilities[metric];
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!cap) return null;
  const meta = AVAILABILITY_META[cap.availability];
  const Icon = ICON[cap.availability];
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-describedby={id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className={clsx("inline-flex items-center gap-1 rounded-full text-[11px] font-medium", TONE[cap.availability])}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {!compact && <span>{meta.label}</span>}
        <span className="sr-only">{meta.label}</span>
      </button>
      <span
        id={id}
        role="tooltip"
        className={clsx(
          "absolute left-1/2 top-full z-30 mt-1.5 w-60 -translate-x-1/2 rounded-lg border border-line bg-surface p-2.5 text-left text-xs font-normal text-ink-soft shadow-lg",
          open ? "block" : "hidden",
        )}
      >
        <span className={clsx("mb-1 flex items-center gap-1 font-semibold", TONE[cap.availability])}>
          <Icon className="h-3.5 w-3.5" aria-hidden /> {meta.label}
        </span>
        {cap.note}
      </span>
    </span>
  );
}

export function AvailabilityLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-soft">
      {(Object.keys(AVAILABILITY_META) as MetricAvailability[]).map((k) => {
        const Icon = ICON[k];
        return (
          <li key={k} className="inline-flex items-center gap-1.5">
            <Icon className={clsx("h-3.5 w-3.5", TONE[k])} aria-hidden />
            <span className="font-medium text-ink">{AVAILABILITY_META[k].label}</span>
            <span className="hidden text-ink-muted lg:inline">— {AVAILABILITY_META[k].description}</span>
          </li>
        );
      })}
    </ul>
  );
}

export { ICON as AVAILABILITY_ICON, TONE as AVAILABILITY_TONE };
