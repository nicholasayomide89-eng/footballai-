import { deleteStyleExample, savePersonality } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { TopBar } from "@/components/TopBar";
import { db } from "@/lib/db";
import { ensureDefaults } from "@/lib/services/system";

const LEVELS = ["None", "Low", "Medium", "High", "Very high"];

function Slider({ name, label, value, max = 4 }: { name: string; label: string; value: number; max?: number }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type="range" min={0} max={max} step={1} defaultValue={value} list={`${name}-ticks`} aria-valuetext={LEVELS[value]} />
      <div className="row small muted" style={{ justifyContent: "space-between" }}>
        <span>{LEVELS[0]}</span>
        <span>{LEVELS[max]}</span>
      </div>
    </div>
  );
}

export default async function PersonalityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await ensureDefaults();
  const [p, examples] = await Promise.all([
    db.personalityProfile.findUniqueOrThrow({ where: { id: 1 } }),
    db.styleExample.findMany({ orderBy: { approvedAt: "desc" }, take: 50 }),
  ]);
  const facts = (p.factsAboutMe ?? {}) as Record<string, string>;

  return (
    <>
      <TopBar title="AI personality" backHref="/more" />
      <main className="page">
        <Flash params={sp} />
        <form action={savePersonality} className="stack" style={{ gap: 16 }}>
          <section className="card">
            <h2>How you talk</h2>
            <Slider name="humor" label="Humor" value={p.humor} />
            <Slider name="confidence" label="Confidence" value={p.confidence} />
            <Slider name="formality" label="Formality" value={p.formality} />
            <Slider name="flirting" label="Flirting (only ever mirrors the other person)" value={p.flirting} max={3} />
            <div className="grid3" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
              <div className="field">
                <label htmlFor="emojiRate">Emoji</label>
                <select id="emojiRate" name="emojiRate" defaultValue={p.emojiRate}>
                  <option value="none">None</option><option value="rare">Rare</option><option value="some">Some</option><option value="lots">Lots</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="sentenceLength">Message length</label>
                <select id="sentenceLength" name="sentenceLength" defaultValue={p.sentenceLength}>
                  <option value="short">Short</option><option value="mid">Medium</option><option value="long">Long</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="slang">Words and slang you use (comma separated)</label>
              <input id="slang" name="slang" type="text" defaultValue={p.slang.join(", ")} />
            </div>
            <div className="field">
              <label htmlFor="signaturePhrases">Phrases that sound like you</label>
              <input id="signaturePhrases" name="signaturePhrases" type="text" defaultValue={p.signaturePhrases.join(", ")} />
            </div>
            <div className="field">
              <label htmlFor="bannedPhrases">Words Keel must never use</label>
              <input id="bannedPhrases" name="bannedPhrases" type="text" defaultValue={p.bannedPhrases.join(", ")} />
            </div>
          </section>

          <section className="card">
            <h2>What Keel knows about you</h2>
            <p className="small muted">Only what you enter here. Keel won&apos;t guess or add anything else about you.</p>
            {[
              ["work", "Work"],
              ["city", "City"],
              ["interests", "Interests"],
              ["offLimits", "Topics that are off-limits"],
              ["other", "Anything else"],
            ].map(([key, label]) => (
              <div key={key} className="field">
                <label htmlFor={`fact_${key}`}>{label}</label>
                <input id={`fact_${key}`} name={`fact_${key}`} type="text" maxLength={300} defaultValue={facts[key!] ?? ""} />
              </div>
            ))}
          </section>
          <button className="btn primary block" type="submit">Save personality</button>
        </form>

        <section className="card">
          <h2>Learned from what you approved ({examples.length})</h2>
          <p className="small muted">Keel copies your style from messages and captions you sent or approved. Delete any that aren&apos;t really you.</p>
          <ul className="list">
            {examples.map((e) => (
              <li key={e.id} className="row" style={{ padding: "8px 0", flexWrap: "nowrap" }}>
                <span className="small" style={{ flex: 1 }}><span className="tag">{e.kind}</span> {e.text}</span>
                <form action={deleteStyleExample}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="btn" type="submit" style={{ minHeight: 36, fontSize: 13 }}>Remove</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
