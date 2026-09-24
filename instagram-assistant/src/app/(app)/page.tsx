import Link from "next/link";
import { pauseAutomation } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";
import { db } from "@/lib/db";
import { graphClient, NotConnectedError } from "@/lib/instagram/account";
import type { Profile } from "@/lib/instagram/graph";
import { contactName, inboxThreads } from "@/lib/services/inbox";
import { LIMITS, systemState } from "@/lib/services/system";

const MODE_LABEL: Record<string, string> = { suggest: "Suggest only", approve: "Ask before sending", auto: "Auto under your rules" };

export default async function HomePage() {
  const [state, threads, storiesToReview, autoToday] = await Promise.all([
    systemState(),
    inboxThreads(),
    db.storyDraft.count({ where: { status: "suggested" } }),
    db.message.count({ where: { sentBy: "keel_auto", createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
  ]);

  let profile: Profile | null = null;
  let connected = true;
  try {
    const { client } = await graphClient();
    profile = await client.profile();
  } catch (err) {
    if (err instanceof NotConnectedError) connected = false;
  }

  const drafts = threads.filter((t) => t.status.tone === "accent");
  const needsYou = threads.filter((t) => t.status.tone === "warn" && t.status.label.startsWith("Needs you"));
  const waiting = threads.filter((t) => t.status.label.startsWith("Waiting on them") && t.conversation.lastOutboundAt && Date.now() - t.conversation.lastOutboundAt.getTime() > 2 * 86_400_000);

  return (
    <>
      <TopBar title="Home" />
      <main className="page">
        {!connected ? (
          <section className="card warn">
            <p><strong>Instagram isn't connected.</strong> Connect a Creator or Business account to get started.</p>
            <Link className="btn primary" href="/settings">Connect Instagram</Link>
          </section>
        ) : null}

        <section className="card dark" aria-label="Automation status">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="small" style={{ opacity: 0.75 }}>Messages mode</span>
            <span className="small" style={{ opacity: 0.75 }}>Auto-sent in 24h</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong style={{ fontSize: 18 }}>{state.automationOn ? MODE_LABEL[state.messagesMode] : "Paused"}</strong>
            <span className="mono" style={{ fontSize: 18 }}>{autoToday} / {LIMITS.autoMessagesPer24h}</span>
          </div>
          {state.automationOn ? (
            <form action={pauseAutomation}>
              <input type="hidden" name="returnTo" value="/" />
              <input type="hidden" name="reason" value="Paused from Home" />
              <button className="btn danger block" type="submit"><Icon name="pause" size={18} />Pause all automation</button>
            </form>
          ) : (
            <Link className="btn block" href="/rules">Automation is paused. Review and resume</Link>
          )}
        </section>

        <section className="stack">
          <h2>Needs you</h2>
          {drafts.length === 0 && needsYou.length === 0 && storiesToReview === 0 && waiting.length === 0 ? (
            <p className="muted">Nothing waiting on you.</p>
          ) : null}
          {drafts.length ? (
            <Link href={`/inbox/${drafts[0]!.conversation.id}`} className="card" style={{ flexDirection: "row", alignItems: "center", textDecoration: "none", color: "inherit" }}>
              <span className="tag accent">{drafts.length}</span>
              <span style={{ flex: 1 }}><strong>Reply drafts ready</strong><br /><span className="small muted">{drafts.slice(0, 3).map((d) => contactName(d.conversation.contact)).join(", ")}</span></span>
              <Icon name="chevron" size={18} />
            </Link>
          ) : null}
          {needsYou.map((t) => (
            <Link key={t.conversation.id} href={`/inbox/${t.conversation.id}`} className="card" style={{ flexDirection: "row", alignItems: "center", textDecoration: "none", color: "inherit" }}>
              <span className="tag warn">!</span>
              <span style={{ flex: 1 }}><strong>{contactName(t.conversation.contact)}</strong><br /><span className="small muted">{t.status.label}</span></span>
              <Icon name="chevron" size={18} />
            </Link>
          ))}
          {storiesToReview ? (
            <Link href="/stories" className="card" style={{ flexDirection: "row", alignItems: "center", textDecoration: "none", color: "inherit" }}>
              <span className="tag warn">{storiesToReview}</span>
              <span style={{ flex: 1 }}><strong>Stories to review</strong></span>
              <Icon name="chevron" size={18} />
            </Link>
          ) : null}
          {waiting.map((t) => (
            <p key={t.conversation.id} className="card small" style={{ background: "var(--sunken)", borderColor: "transparent" }}>
              {contactName(t.conversation.contact)} hasn&apos;t replied in over 2 days. Keel suggests not following up yet.
            </p>
          ))}
        </section>

        {profile ? (
          <section className="grid3" aria-label="Account">
            <div className="card"><span className="small muted">Followers</span><span className="stat">{profile.followers_count?.toLocaleString() ?? "–"}</span></div>
            <div className="card"><span className="small muted">Following</span><span className="stat">{profile.follows_count?.toLocaleString() ?? "–"}</span></div>
            <div className="card"><span className="small muted">Posts</span><span className="stat">{profile.media_count?.toLocaleString() ?? "–"}</span></div>
          </section>
        ) : null}

        <section className="card accent">
          <h2 style={{ color: "var(--accent-ink)" }}>Story idea</h2>
          <p>Upload a photo and pick a style. Keel checks it makes sense, isn&apos;t repetitive and doesn&apos;t expose anything private, then waits for your approval.</p>
          <Link className="btn primary" href="/stories" style={{ alignSelf: "flex-start" }}>Draft a Story</Link>
        </section>
      </main>
    </>
  );
}
