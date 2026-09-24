import { notFound } from "next/navigation";
import { forgetMemory, regenerateReply, saveContact, sendReply, skipReply } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";
import { db } from "@/lib/db";
import { MESSAGING_WINDOW_MS, type PolicyDecision } from "@/lib/policy/engine";
import { contactName } from "@/lib/services/inbox";

interface CriticView {
  makes_sense?: boolean;
  sounds_like_owner?: number;
  issues?: string[];
  flags?: string[];
  verdict?: string;
  recommendation?: string;
  their_tone?: string;
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const convo = await db.conversation.findUnique({
    where: { id },
    include: {
      contact: true,
      memory: { orderBy: { createdAt: "asc" } },
      messages: { orderBy: { createdAt: "desc" }, take: 40 },
      suggestions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!convo) notFound();

  const messages = [...convo.messages].reverse();
  const suggestion = convo.suggestions[0];
  const critic = (suggestion?.critic ?? {}) as CriticView;
  const policy = suggestion?.policy as unknown as PolicyDecision | undefined;
  const windowLeftMs = convo.lastInboundAt ? MESSAGING_WINDOW_MS - (Date.now() - convo.lastInboundAt.getTime()) : -1;
  const awaitingThem = convo.lastOutboundAt !== null && (convo.lastInboundAt === null || convo.lastOutboundAt > convo.lastInboundAt);
  const name = contactName(convo.contact);

  return (
    <>
      <TopBar title={name} backHref="/inbox" />
      <main className="page">
        <Flash params={sp} />
        <div className="row">
          <span className="tag">{convo.tone ?? convo.contact.relationship}</span>
          {windowLeftMs > 0 ? (
            <span className="tag ok">Reply window: {Math.ceil(windowLeftMs / 3_600_000)}h left</span>
          ) : (
            <span className="tag warn">Reply window closed</span>
          )}
          {awaitingThem ? <span className="tag">Waiting on them</span> : null}
        </div>

        {convo.memory.length ? (
          <details className="card" style={{ borderStyle: "dashed" }}>
            <summary className="small"><strong>Keel remembers</strong> ({convo.memory.length})</summary>
            <ul className="list">
              {convo.memory.map((m) => (
                <li key={m.id} className="row" style={{ padding: "6px 0", flexWrap: "nowrap" }}>
                  <span className="small" style={{ flex: 1 }}>{m.content} <span className="muted">· {m.kind.replace("_", " ")}</span></span>
                  <form action={forgetMemory}>
                    <input type="hidden" name="conversationId" value={convo.id} />
                    <input type="hidden" name="memoryId" value={m.id} />
                    <button className="btn" type="submit" style={{ minHeight: 36, fontSize: 13 }}>Forget</button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <section className="bubbles" aria-label="Messages">
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.direction === "outbound" ? "me" : "them"}`}>
              {m.text ?? "[attachment]"}
              <span className="meta">
                {m.createdAt.toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                {m.sentBy === "keel_auto" ? " · auto-sent by Keel" : m.sentBy === "keel_approved" ? " · sent via Keel" : ""}
              </span>
            </div>
          ))}
        </section>

        {suggestion && suggestion.status === "open" && suggestion.kind === "reply" ? (
          <section className="card" style={{ borderColor: "var(--accent)", borderWidth: 1.5 }} aria-label="Suggested reply">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ color: "var(--accent-ink)" }}>Suggested reply</h2>
              {critic.sounds_like_owner !== undefined ? <span className="small muted">Sounds like you: {critic.sounds_like_owner}%</span> : null}
            </div>
            <form action={sendReply} className="stack">
              <input type="hidden" name="suggestionId" value={suggestion.id} />
              <input type="hidden" name="conversationId" value={convo.id} />
              <label htmlFor="text" className="small muted">Edit before sending if you like</label>
              <textarea id="text" name="text" defaultValue={suggestion.draft ?? ""} maxLength={1000} required />
              <p className="small muted"><strong style={{ color: "var(--ink)" }}>Why:</strong> {suggestion.rationale}</p>
              {critic.issues?.length ? (
                <ul className="small" style={{ margin: 0, paddingLeft: 18, color: "var(--warn)" }}>
                  {critic.issues.map((i) => <li key={i}>{i}</li>)}
                </ul>
              ) : null}
              {policy?.reasons?.length ? (
                <ul className="small" style={{ margin: 0, paddingLeft: 18, color: "var(--warn)" }}>
                  {policy.reasons.map((r) => <li key={r.key}>{r.message}</li>)}
                </ul>
              ) : (
                <div className="row small" style={{ color: "var(--ok)", fontWeight: 600, flexWrap: "nowrap" }}>
                  <Icon name="check" size={14} stroke={3} />Passed your hard rules and Instagram&apos;s limits
                </div>
              )}
              <button className="btn primary block" type="submit">Send</button>
            </form>
            <div className="row">
              <form action={skipReply}>
                <input type="hidden" name="suggestionId" value={suggestion.id} />
                <input type="hidden" name="conversationId" value={convo.id} />
                <button className="btn" type="submit">Skip</button>
              </form>
              <form action={regenerateReply}>
                <input type="hidden" name="conversationId" value={convo.id} />
                <button className="btn" type="submit">Try another</button>
              </form>
            </div>
          </section>
        ) : suggestion && suggestion.status === "open" && suggestion.kind === "no_reply" ? (
          <section className="card">
            <h2>Keel suggests {critic.recommendation === "wait" ? "waiting" : "not replying"}</h2>
            <p>{suggestion.rationale}</p>
            <form action={regenerateReply}>
              <input type="hidden" name="conversationId" value={convo.id} />
              <button className="btn" type="submit">Draft a reply anyway</button>
            </form>
          </section>
        ) : suggestion && suggestion.status === "blocked" ? (
          <section className="card warn">
            <h2 style={{ color: "var(--warn)" }}>Draft held back</h2>
            {suggestion.draft ? <p style={{ whiteSpace: "pre-wrap" }}>&ldquo;{suggestion.draft}&rdquo;</p> : null}
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {(policy?.reasons ?? []).map((r) => <li key={r.key}>{r.message}</li>)}
            </ul>
            <p className="small muted">You can still reply yourself in the Instagram app.</p>
          </section>
        ) : !awaitingThem && windowLeftMs > 0 ? (
          <form action={regenerateReply}>
            <input type="hidden" name="conversationId" value={convo.id} />
            <button className="btn primary block" type="submit">Suggest a reply</button>
          </form>
        ) : null}

        <details className="card">
          <summary><strong>Contact settings</strong></summary>
          <form action={saveContact} className="stack" style={{ marginTop: 10 }}>
            <input type="hidden" name="contactId" value={convo.contact.id} />
            <input type="hidden" name="conversationId" value={convo.id} />
            <div className="field">
              <label htmlFor="displayName">Name</label>
              <input id="displayName" name="displayName" type="text" defaultValue={convo.contact.displayName ?? ""} maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="relationship">Relationship</label>
              <select id="relationship" name="relationship" defaultValue={convo.contact.relationship}>
                {["friend", "casual", "professional", "networking", "dating", "unknown"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="aiAccess">What Keel may do here</label>
              <select id="aiAccess" name="aiAccess" defaultValue={convo.contact.aiAccess}>
                <option value="none">Nothing: no AI in this chat</option>
                <option value="suggest">Suggest only</option>
                <option value="approve">Draft, and send when I approve</option>
                <option value="auto">Auto-reply under my approved rules</option>
              </select>
            </div>
            <button className="btn" type="submit">Save</button>
          </form>
        </details>
      </main>
    </>
  );
}
