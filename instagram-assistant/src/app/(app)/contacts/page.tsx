import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { db } from "@/lib/db";
import { contactName } from "@/lib/services/inbox";

const ACCESS: Record<string, string> = { none: "No AI", suggest: "Suggest only", approve: "Ask before sending", auto: "Auto under rules" };

export default async function ContactsPage() {
  const contacts = await db.contact.findMany({
    where: { igAccount: { status: "active" } },
    include: { conversation: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <TopBar title="Contacts" backHref="/more" />
      <main className="page">
        <p className="small muted">People who have messaged you. New contacts start at &ldquo;Suggest only&rdquo;; only you can give Keel more access.</p>
        <ul className="list">
          {contacts.map((c) => (
            <li key={c.id}>
              <Link href={c.conversation ? `/inbox/${c.conversation.id}` : "/inbox"} className="threadlink">
                <span style={{ flex: 1 }}>
                  <strong>{contactName(c)}</strong>
                  <br />
                  <span className="small muted">{c.relationship}</span>
                </span>
                <span className={`tag ${c.aiAccess === "auto" ? "warn" : c.aiAccess === "none" ? "" : "accent"}`} style={{ alignSelf: "center" }}>{ACCESS[c.aiAccess]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
