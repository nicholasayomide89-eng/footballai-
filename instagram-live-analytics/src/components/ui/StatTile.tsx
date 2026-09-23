import clsx from "clsx";
import type { ReactNode } from "react";
import type { MetricKey } from "@/types/analytics";
import { AvailabilityBadge } from "./AvailabilityBadge";

export function StatTile({
  label,
  value,
  sub,
  icon,
  metric,
  emphasis = false,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  metric?: MetricKey;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx("relative min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-card", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-ink-muted">
          {icon && <span className="text-ink-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
          <span className="truncate">{label}</span>
        </span>
        {metric && <AvailabilityBadge metric={metric} />}
      </div>
      <div className={clsx("tabular mt-2 font-semibold tracking-tight text-ink", emphasis ? "text-3xl" : "text-2xl")}>{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}
