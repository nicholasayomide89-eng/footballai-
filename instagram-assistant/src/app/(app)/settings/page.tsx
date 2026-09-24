import { Flash } from "@/components/Flash";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";
import { db } from "@/lib/db";
import { activeAccount } from "@/lib/instagram/account";
import { SCOPE_EXPLANATIONS, SCOPES } from "@/lib/instagram/oauth";

const CANNOT = [
  "See the list of who follows you or who you follow (only the counts)",
  "Message people who haven't messaged you first",
  "Reply more than 24 hours after someone's last message",
  "Add stickers, polls, music, links or text to Stories",
  "Follow, like, comment or unfollow on your behalf",
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const account = await activeAccount();
  const caps = account ? await db.capability.findMany({ where: { igAccountId: account.id } }) : [];
  const capStatus = new Map(caps.map((c) => [c.key, c.status]));

  return (
    <>
      <TopBar title="Settings" backHref="/more" />
      <main className="page">
        <Flash params={sp} />
        <section className="card">
          <h2>Instagram connection</h2>
          {account ? (
            <>
              <p><strong>@{account.username}</strong> <span className="muted small">({account.accountType.toLowerCase()} account)</span></p>
              <p className="small muted">
                Connected {account.connectedAt.toLocaleDateString()}. Access expires {account.token?.expiresAt.toLocaleDateString() ?? "–"}. Keel refreshes it automatically.
              </p>
              <form method="post" action="/api/instagram/disconnect">
                <button className="btn danger" type="submit">Disconnect and delete Instagram data</button>
              </form>
            </>
          ) : (
            <>
              <p>You&apos;ll sign in on Instagram&apos;s own page. Keel never sees or stores your Instagram password.</p>
              <p className="small banner" style={{ background: "var(--warn-soft)", color: "var(--ink)" }}>
                Needs a free Creator or Business account. Professional accounts can&apos;t be private. In Instagram, also turn on Settings → Messages and story replies → Message controls → Connected tools → <em>Allow access to messages</em>.
              </p>
              <a className="btn primary" href="/api/instagram/connect">Continue with Instagram</a>
            </>
          )}
        </section>

        <section className="card">
          <h2>What Keel can do</h2>
          {SCOPES.map((s) => {
            const status = capStatus.get(s);
            return (
              <div key={s} className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                <span style={{ color: status === "missing" ? "var(--warn)" : "var(--ok)", marginTop: 2 }}>
                  <Icon name={status === "missing" ? "x" : "check"} size={16} stroke={3} />
                </span>
                <span className="small" style={{ flex: 1 }}>
                  {SCOPE_EXPLANATIONS[s]}
                  {status === "missing" ? <span style={{ color: "var(--warn)" }}> (not granted)</span> : null}
                  <br />
                  <code className="muted">{s}</code>
                </span>
              </div>
            );
          })}
          {capStatus.get("webhooks.messages") === "missing" ? (
            <p className="small" style={{ color: "var(--warn)" }}>Message webhooks couldn&apos;t be enabled, so new DMs won&apos;t arrive automatically. Check the webhook setup in your Meta app.</p>
          ) : null}
        </section>

        <section className="card">
          <h2>What Instagram doesn&apos;t allow, so Keel won&apos;t try</h2>
          {CANNOT.map((c) => (
            <div key={c} className="row small" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
              <span style={{ color: "var(--stop)", marginTop: 2 }}><Icon name="x" size={16} stroke={3} /></span>
              <span>{c}</span>
            </div>
          ))}
        </section>

        <form method="post" action="/api/auth/logout">
          <button className="btn block" type="submit">Sign out of Keel</button>
        </form>
      </main>
    </>
  );
}
