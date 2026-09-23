import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Search, X } from "lucide-react";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={clsx("min-w-0 rounded-2xl border border-line bg-surface shadow-card", className)}>{children}</section>;
}

export function CardHeader({
  title,
  subtitle,
  actions,
  badge,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <header className={clsx("flex flex-wrap items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {badge}
        </div>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("px-5 pb-5 pt-4", className)}>{children}</div>;
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "brand";
export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--series-1)] disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-ink text-surface hover:bg-ink/85",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-surface-sunken",
        variant === "ghost" && "text-ink-soft hover:bg-surface-sunken hover:text-ink",
        variant === "brand" && "bg-brand-gradient text-white shadow-sm hover:opacity-90",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({
  tone = "neutral",
  children,
  className,
  title,
}: {
  tone?: "neutral" | "good" | "warning" | "critical" | "brand" | "info";
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
        tone === "neutral" && "bg-surface-sunken text-ink-soft",
        tone === "good" && "bg-[color-mix(in_srgb,var(--status-good)_14%,transparent)] text-[var(--status-good)]",
        tone === "warning" && "bg-[color-mix(in_srgb,var(--status-warning)_16%,transparent)] text-[var(--status-warning)]",
        tone === "critical" && "bg-[color-mix(in_srgb,var(--status-critical)_14%,transparent)] text-[var(--status-critical)]",
        tone === "info" && "bg-[color-mix(in_srgb,var(--series-1)_14%,transparent)] text-[var(--series-1)]",
        tone === "brand" && "bg-brand-gradient text-white",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex max-w-full overflow-x-auto rounded-lg border border-line bg-surface-sunken p-0.5 scrollbar-thin">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "whitespace-nowrap rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={clsx("relative flex items-center", className)}>
      <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-ink-muted" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-8 text-sm text-ink placeholder:text-ink-muted focus:border-[var(--series-1)] focus:outline-none"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute right-2 rounded p-0.5 text-ink-muted hover:text-ink" aria-label="Clear search">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </label>
  );
}

export function Select<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink focus:border-[var(--series-1)] focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-[var(--series-1)]" : "bg-line")}
    >
      <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon && <div className="text-ink-muted">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="max-w-sm text-[13px] text-ink-muted">{children}</div>}
    </div>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return <span className={clsx("live-dot inline-block h-2 w-2 rounded-full bg-[var(--status-critical)]", className)} aria-hidden />;
}

export function SectionTitle({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
