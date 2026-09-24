import Link from "next/link";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";

const GROUPS: Array<{ title: string; items: Array<{ label: string; sub: string; href?: string }> }> = [
  {
    title: "Assistant",
    items: [
      { label: "AI Replies", sub: "Drafts waiting in your inbox", href: "/inbox" },
      { label: "Automation Rules", sub: "Modes and auto-reply rules", href: "/rules" },
      { label: "AI Personality", sub: "How you talk, what Keel knows", href: "/personality" },
    ],
  },
  {
    title: "Content",
    items: [
      { label: "Stories", sub: "Draft, review, publish", href: "/stories" },
      { label: "Content Planner", sub: "Coming in phase 2" },
      { label: "Contacts", sub: "Who Keel may help with", href: "/contacts" },
    ],
  },
  {
    title: "Control",
    items: [
      { label: "Activity History", sub: "Every action, with the reason", href: "/activity" },
      { label: "Safety Controls", sub: "Pause switch and hard rules", href: "/rules" },
      { label: "Settings & permissions", sub: "Instagram connection", href: "/settings" },
    ],
  },
];

export default function MorePage() {
  return (
    <>
      <TopBar title="More" />
      <main className="page">
        {GROUPS.map((g) => (
          <section key={g.title} className="stack">
            <h2>{g.title}</h2>
            <ul className="list card" style={{ padding: "0 14px", gap: 0 }}>
              {g.items.map((it) => (
                <li key={it.label}>
                  {it.href ? (
                    <Link href={it.href} className="threadlink" style={{ alignItems: "center" }}>
                      <span style={{ flex: 1 }}><strong>{it.label}</strong><br /><span className="small muted">{it.sub}</span></span>
                      <Icon name="chevron" size={16} />
                    </Link>
                  ) : (
                    <div className="threadlink" aria-disabled="true">
                      <span style={{ flex: 1 }}><strong className="muted">{it.label}</strong><br /><span className="small muted">{it.sub}</span></span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
