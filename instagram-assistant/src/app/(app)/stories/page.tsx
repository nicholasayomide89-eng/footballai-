import Link from "next/link";
import { uploadStory } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { TopBar } from "@/components/TopBar";
import { STORY_STYLES } from "@/lib/ai/stories";
import { db } from "@/lib/db";

const STATUS_TAG: Record<string, string> = {
  suggested: "accent",
  approved: "accent",
  published: "ok",
  handoff: "ok",
  rejected: "",
  failed: "stop",
};

export default async function StoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const drafts = await db.storyDraft.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { mediaAsset: true } });
  return (
    <>
      <TopBar title="Stories" />
      <main className="page">
        <Flash params={sp} />
        <form action={uploadStory} className="card">
          <h2>New Story</h2>
          <div className="field">
            <label htmlFor="media">Photo or video</label>
            <input id="media" name="media" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" required />
          </div>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Style</legend>
            <div className="row">
              {STORY_STYLES.map((s, i) => (
                <label key={s} className="tag" style={{ minHeight: 36, padding: "0 12px", cursor: "pointer" }}>
                  <input type="radio" name="style" value={s} defaultChecked={i === 2} /> {s}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="note">Anything Keel should know? (optional)</label>
            <input id="note" name="note" type="text" maxLength={500} placeholder="e.g. Sunday market with my sister" />
          </div>
          <button className="btn primary" type="submit">Draft Story</button>
          <p className="small muted">Keel checks whether it makes sense, whether it repeats a recent Story, and whether it shows anything private. Nothing is posted until you approve it.</p>
        </form>

        <section className="stack">
          <h2>Drafts and history</h2>
          {drafts.length === 0 ? <p className="muted">No Stories yet.</p> : null}
          <ul className="list">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link href={`/stories/${d.id}`} className="threadlink">
                  <span style={{ flex: 1 }}>
                    <strong>{d.overlayText || d.mediaAsset.originalName || "Untitled"}</strong>
                    <br />
                    <span className="small muted">{d.style} · {d.createdAt.toLocaleDateString()}</span>
                  </span>
                  <span className={`tag ${STATUS_TAG[d.status] ?? ""}`} style={{ alignSelf: "center" }}>{d.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
