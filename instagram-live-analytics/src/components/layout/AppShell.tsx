import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { Database, Menu, Moon, Sun, X } from "lucide-react";
import { useDashboard } from "@/state/DashboardContext";
import { formatDate } from "@/lib/format";
import { LiveDot } from "@/components/ui/primitives";
import { NAV, type PageId } from "./navigation";

export function AppShell({ page, onNavigate, children }: { page: PageId; onNavigate: (p: PageId) => void; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [page]);

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-line bg-surface lg:block">
        <Sidebar page={page} onNavigate={onNavigate} />
      </aside>

      {/* Mobile drawer */}
      <div className={clsx("fixed inset-0 z-40 lg:hidden", menuOpen ? "" : "pointer-events-none")} aria-hidden={!menuOpen}>
        <div className={clsx("absolute inset-0 bg-black/40 transition-opacity", menuOpen ? "opacity-100" : "opacity-0")} onClick={() => setMenuOpen(false)} />
        <aside className={clsx("absolute inset-y-0 left-0 w-72 max-w-[85%] border-r border-line bg-surface shadow-xl transition-transform", menuOpen ? "translate-x-0" : "-translate-x-full")}>
          <button type="button" onClick={() => setMenuOpen(false)} className="absolute right-3 top-4 rounded-lg p-1.5 text-ink-muted hover:bg-surface-sunken" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
          <Sidebar page={page} onNavigate={onNavigate} />
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ page, onNavigate }: { page: PageId; onNavigate: (p: PageId) => void }) {
  const { currentLiveId } = useDashboard();
  const groups: { key: string; label: string }[] = [
    { key: "live", label: "Live" },
    { key: "history", label: "History" },
    { key: "app", label: "" },
  ];
  return (
    <nav className="flex h-full flex-col overflow-y-auto px-3 py-5 scrollbar-thin" aria-label="Main">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <circle cx="12" cy="12" r="3.5" />
            <path d="M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <div className="text-[15px] font-semibold leading-tight text-ink">LiveLens</div>
          <div className="text-[11px] leading-tight text-ink-muted">Live analytics for creators</div>
        </div>
      </div>
      {groups.map((g) => (
        <div key={g.key} className={clsx("mb-4", g.key === "app" && "mt-auto")}>
          {g.label && <div className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{g.label}</div>}
          <ul className="space-y-0.5">
            {NAV.filter((n) => n.group === g.key).map((n) => {
              const active = page === n.id;
              const Icon = n.icon;
              return (
                <li key={n.id}>
                  <a
                    href={`#/${n.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(n.id);
                    }}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      active ? "bg-surface-sunken text-ink" : "text-ink-soft hover:bg-surface-sunken/70 hover:text-ink",
                    )}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand-gradient" aria-hidden />}
                    <Icon className={clsx("h-[18px] w-[18px]", active ? "text-ink" : "text-ink-muted group-hover:text-ink-soft")} aria-hidden />
                    <span className="flex-1">{n.label}</span>
                    {n.id === "monitor" && currentLiveId && <LiveDot />}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { session, previousLives, currentLiveId, activeLiveId, setActiveLiveId, sourceLabel, sourceKind } = useDashboard();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("livelens-theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={onMenu} className="-ml-1 rounded-lg p-1.5 text-ink-soft hover:bg-surface-sunken lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>

        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="sr-only">Selected Live</span>
          {session?.status === "live" && session.id === activeLiveId ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--status-critical)_12%,transparent)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--status-critical)]">
              <LiveDot /> Live
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Replay</span>
          )}
          <select
            value={activeLiveId ?? ""}
            onChange={(e) => setActiveLiveId(e.target.value)}
            className="min-w-0 max-w-full flex-1 truncate rounded-lg border-0 bg-transparent py-1 pr-7 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-[var(--series-1)] sm:flex-none sm:max-w-[420px]"
          >
            {currentLiveId && session && session.id === currentLiveId && <option value={currentLiveId}>● Now live: {session.title}</option>}
            {currentLiveId && session?.id !== currentLiveId && <option value={currentLiveId}>● Current Live</option>}
            {previousLives.map((l) => (
              <option key={l.id} value={l.id}>
                {formatDate(l.startedAt)} — {l.title}
              </option>
            ))}
          </select>
        </label>

        <span
          className={clsx(
            "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium md:inline-flex",
            sourceKind === "mock" ? "border-[color-mix(in_srgb,var(--status-warning)_40%,transparent)] text-[var(--status-warning)]" : "border-line text-ink-soft",
          )}
          title="Active data source — change it in src/services/index.ts"
        >
          <Database className="h-3.5 w-3.5" aria-hidden />
          {sourceLabel}
        </span>

        <button type="button" onClick={toggleTheme} className="rounded-lg p-2 text-ink-soft hover:bg-surface-sunken hover:text-ink" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
          {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <span className="hidden items-center gap-2 sm:flex">
          <span className="rounded-full bg-brand-gradient p-[2px]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-[11px] font-semibold text-ink">SN</span>
          </span>
        </span>
      </div>
    </header>
  );
}
