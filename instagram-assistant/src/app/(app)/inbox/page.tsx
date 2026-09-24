import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { contactName, inboxThreads, timeAgo } from "@/lib/services/inbox";

export default async function InboxPage() {
  const threads = await inboxThreads();
  return (
    <>
      <TopBar title="Inbox" />
      <main className="page">
        <p className="small muted">Conversations appear here when people message you. Instagram doesn&apos;t let apps start new conversations.</p>
        {threads.length === 0 ? <p className="muted">No conversations yet.</p> : null}
        <ul className="list">
          {threads.map(({ conversation: c, last, status }) => (
            <li key={c.id}>
              <Link href={`/inbox/${c.id}`} className="threadlink">
                <span className="avatar" aria-hidden="true">{contactName(c.contact).replace("@", "")[0]?.toUpperCase()}</span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span className="row" style={{ flexWrap: "nowrap" }}>
                    <strong>{contactName(c.contact)}</strong>
                    <span className="small muted">{c.tone ?? c.contact.relationship}</span>
                    <span className="small muted" style={{ marginLeft: "auto" }}>{last ? timeAgo(last.createdAt) : ""}</span>
                  </span>
                  <span className="small ellipsis" style={{ color: "var(--ink-2)" }}>
                    {last ? `${last.direction === "outbound" ? "You: " : ""}${last.text ?? "[attachment]"}` : ""}
                  </span>
                  <span className={`tag ${status.tone === "neutral" ? "" : status.tone}`} style={{ alignSelf: "flex-start" }}>{status.label}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
