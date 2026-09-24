"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const TABS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/inbox", label: "Inbox", icon: "inbox" },
  { href: "/stories", label: "Stories", icon: "stories" },
  { href: "/analytics", label: "Analytics", icon: "insights" },
  { href: "/more", label: "More", icon: "more" },
];

const MORE_SECTIONS = ["/more", "/rules", "/personality", "/activity", "/settings", "/contacts", "/planner"];

export function BottomNav() {
  const path = usePathname();
  const active = (href: string) =>
    href === "/" ? path === "/" : href === "/more" ? MORE_SECTIONS.some((p) => path.startsWith(p)) : path.startsWith(href);
  return (
    <nav className="bottomnav" aria-label="Main">
      <ul>
        {TABS.map((t) => (
          <li key={t.href}>
            <Link href={t.href} aria-current={active(t.href) ? "page" : undefined}>
              <Icon name={t.icon} />
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
