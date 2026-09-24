import { createAutoRule, pauseAutomation, resumeAutomation, saveModes, saveSafetyRules, toggleAutoRule } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";
import { db } from "@/lib/db";
import { ensureDefaults, LIMITS, systemState } from "@/lib/services/system";

export default async function RulesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await ensureDefaults();
  const [state, safety, autoRules] = await Promise.all([
    systemState(),
    db.safetyRule.findMany({ orderBy: { key: "asc" } }),
    db.automationRule.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <>
      <TopBar title="Rules & safety" backHref="/more" />
      <main className="page">
        <Flash params={sp} />

        {state.automationOn ? (
          <section className="card stop">
            <strong style={{ color: "var(--stop)" }}>Emergency pause</strong>
            <p className="small">Stops every automatic reply and post immediately, including ones already in progress. Drafting and your own approved sends keep working.</p>
            <form action={pauseAutomation} className="stack">
              <input type="hidden" name="returnTo" value="/rules" />
              <input type="text" name="reason" placeholder="Reason (optional)" aria-label="Reason for pausing" maxLength={200} />
              <button className="btn danger block" type="submit"><Icon name="pause" size={18} />Pause all automation</button>
            </form>
          </section>
        ) : (
          <section className="card dark">
            <strong>All automation paused</strong>
            <p className="small" style={{ opacity: 0.85 }}>
              Since {state.pausedAt?.toLocaleString() ?? "–"}{state.pausedReason ? `: ${state.pausedReason}` : ""}. Nothing is sent or posted automatically.
            </p>
            <form action={resumeAutomation} className="stack">
              <label className="check" style={{ color: "inherit" }}>
                <input type="checkbox" name="confirm" value="yes" required />
                I&apos;ve reviewed my rules and want automation back on
              </label>
              <button className="btn block" type="submit">Resume automation</button>
            </form>
          </section>
        )}

        <form action={saveModes} className="card">
          <h2>Modes</h2>
          <div className="field">
            <label htmlFor="messagesMode">Messages</label>
            <select id="messagesMode" name="messagesMode" defaultValue={state.messagesMode}>
              <option value="suggest">Suggest only: I copy and send myself</option>
              <option value="approve">Ask before sending: I tap Send</option>
              <option value="auto">Auto-reply, but only under rules I approved</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="storiesMode">Stories</label>
            <select id="storiesMode" name="storiesMode" defaultValue={state.storiesMode}>
              <option value="approve">I approve every Story</option>
              <option value="auto" disabled>Auto-post under rules (phase 2)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="timezone">Your timezone</label>
            <input id="timezone" name="timezone" type="text" defaultValue={state.timezone} placeholder="e.g. Africa/Lagos" />
          </div>
          <button className="btn" type="submit">Save modes</button>
        </form>

        <form action={saveSafetyRules} className="card">
          <h2>Hard rules</h2>
          <p className="small muted">Checked by code on every message, whatever the AI thinks. Locked rules can&apos;t be turned off.</p>
          {safety.map((r) => (
            <label key={r.key} className="check">
              <input type="checkbox" name={r.key} defaultChecked={r.enabled} disabled={r.locked} />
              <span style={{ flex: 1 }}>{r.label}</span>
              {r.locked ? <span className="muted" title="Always on"><Icon name="lock" size={16} /></span> : null}
            </label>
          ))}
          <button className="btn" type="submit">Save hard rules</button>
        </form>

        <section className="card">
          <h2>Auto-reply rules</h2>
          <p className="small muted">
            These only apply when Messages is set to auto and the contact allows auto-replies. Even then, Keel asks you first for first messages, dating chats, commitments, anything the AI critic flags, and after {LIMITS.autoMessagesPer24h} automatic messages a day.
          </p>
          {autoRules.length === 0 ? <p className="small">No rules yet.</p> : null}
          {autoRules.map((r) => {
            const c = r.conditions as { conversationTypes?: string[]; maxChars?: number };
            return (
              <div key={r.id} className="row" style={{ flexWrap: "nowrap", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <span style={{ flex: 1 }}>
                  <strong>{r.name}</strong>
                  <br />
                  <span className="small muted">
                    {c.conversationTypes?.join(", ")} · up to {c.maxChars} chars · {r.activeFrom}:00–{r.activeTo}:00 · max {r.dailyCap}/day
                  </span>
                </span>
                <form action={toggleAutoRule}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="btn" type="submit" aria-label={`${r.enabled ? "Turn off" : "Turn on"} ${r.name}`}>{r.enabled ? "On" : "Off"}</button>
                </form>
              </div>
            );
          })}
          <details>
            <summary className="small"><strong>Add a rule</strong></summary>
            <form action={createAutoRule} className="stack" style={{ marginTop: 10 }}>
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" name="name" type="text" required minLength={3} maxLength={80} placeholder="Short friendly replies" />
              </div>
              <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Conversation types</legend>
                {["friendly", "casual", "professional", "networking"].map((t) => (
                  <label key={t} className="check"><input type="checkbox" name="conversationTypes" value={t} /> {t}</label>
                ))}
                <p className="small muted">Dating conversations can never be auto-replied.</p>
              </fieldset>
              <div className="grid3">
                <div className="field"><label htmlFor="maxChars">Max length</label><input id="maxChars" name="maxChars" type="number" min={20} max={500} defaultValue={120} /></div>
                <div className="field"><label htmlFor="activeFrom">From hour</label><input id="activeFrom" name="activeFrom" type="number" min={0} max={23} defaultValue={9} /></div>
                <div className="field"><label htmlFor="activeTo">To hour</label><input id="activeTo" name="activeTo" type="number" min={0} max={23} defaultValue={22} /></div>
              </div>
              <div className="field"><label htmlFor="dailyCap">Max per day</label><input id="dailyCap" name="dailyCap" type="number" min={1} max={10} defaultValue={5} /></div>
              <label className="check"><input type="checkbox" name="confirm" value="yes" required /> I approve Keel sending replies that match this rule without asking me</label>
              <button className="btn primary" type="submit">Approve rule</button>
            </form>
          </details>
        </section>
      </main>
    </>
  );
}
