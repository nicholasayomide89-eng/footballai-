import { notFound } from "next/navigation";
import { handoffStory, publishStoryAction, rejectStoryAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";
import { db } from "@/lib/db";

interface Quality {
  makes_sense?: boolean;
  concerns?: string[];
  similarity_to_recent?: "none" | "some" | "high";
}
interface Sticker {
  type: string;
  prompt: string;
  options: string[];
}

export default async function StoryReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const d = await db.storyDraft.findUnique({ where: { id }, include: { mediaAsset: true } });
  if (!d) notFound();
  const q = (d.quality ?? {}) as Quality;
  const sticker = d.stickerIdea as Sticker | null;
  const open = d.status === "suggested" || d.status === "approved" || d.status === "failed";
  const copyText = [d.overlayText, sticker ? `${sticker.type}: ${sticker.prompt} ${sticker.options.join(" / ")}` : null, d.hashtags.map((h) => `#${h}`).join(" ")]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      <TopBar title="Story review" backHref="/stories" />
      <main className="page">
        <Flash params={sp} />
        <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap", gap: 14 }}>
          {d.mediaAsset.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="preview" src={`/api/media/${d.mediaAssetId}`} alt="Your Story media" style={{ width: 150 }} />
          ) : (
            <video className="preview" src={`/api/media/${d.mediaAssetId}`} controls style={{ width: 150 }} />
          )}
          <div className="stack" style={{ flex: 1 }}>
            <h2>Quality check</h2>
            <p className="row small" style={{ flexWrap: "nowrap", alignItems: "flex-start", color: d.recommended ? "var(--ok)" : "var(--warn)" }}>
              <Icon name={d.recommended ? "check" : "x"} size={16} stroke={3} />
              <strong>{d.recommended ? "Recommended" : "Not recommended"}</strong>
            </p>
            {q.similarity_to_recent && q.similarity_to_recent !== "none" ? (
              <p className="small">Similar to a recent Story: <strong>{q.similarity_to_recent}</strong></p>
            ) : null}
            {(q.concerns ?? []).map((c) => (
              <p key={c} className="small" style={{ color: "var(--warn)" }}>{c}</p>
            ))}
          </div>
        </div>

        <section className="card">
          <p className="small"><span className="muted">Style:</span> {d.style}</p>
          {d.overlayText ? <p><span className="muted small">Text:</span> {d.overlayText}</p> : null}
          {sticker ? (
            <p><span className="muted small">Sticker ({sticker.type}):</span> {sticker.prompt} {sticker.options.length ? `(${sticker.options.join(" / ")})` : ""}</p>
          ) : null}
          {d.musicIdea ? <p><span className="muted small">Music idea:</span> {d.musicIdea}</p> : null}
          {d.hashtags.length ? <p className="small">{d.hashtags.map((h) => `#${h}`).join(" ")}</p> : null}
          {d.caption ? <p className="small muted">{d.caption}</p> : null}
        </section>

        {d.status === "failed" && d.failureReason ? <p className="banner error">Last attempt failed: {d.failureReason}</p> : null}

        {open ? (
          <>
            <p className="banner" style={{ background: "var(--warn-soft)", color: "var(--ink)" }}>
              Instagram&apos;s API publishes the photo or video only. It can&apos;t add text, stickers, polls or music. To include them, use <strong>Finish in Instagram</strong>: save the media, copy the text below, and add them in the Instagram app.
            </p>
            {copyText ? (
              <div className="field">
                <label htmlFor="copy">Text to copy</label>
                <textarea id="copy" readOnly defaultValue={copyText} />
              </div>
            ) : null}
            <div className="stack">
              <form action={publishStoryAction} className="stack">
                <input type="hidden" name="draftId" value={d.id} />
                <label className="check">
                  <input type="checkbox" name="confirm" value="yes" required />
                  Post this {d.mediaAsset.kind} to my Story now, without text or stickers
                </label>
                <button className="btn primary block" type="submit">Publish media now</button>
              </form>
              <a className="btn block" href={`/api/media/${d.mediaAssetId}`} download={d.mediaAsset.originalName ?? "story"}>Save media for Instagram</a>
              <form action={handoffStory}>
                <input type="hidden" name="draftId" value={d.id} />
                <button className="btn block" type="submit">I posted it in Instagram</button>
              </form>
              <form action={rejectStoryAction}>
                <input type="hidden" name="draftId" value={d.id} />
                <button className="btn block" type="submit">Don&apos;t post this</button>
              </form>
            </div>
          </>
        ) : (
          <p className="tag ok" style={{ alignSelf: "flex-start" }}>{d.status}</p>
        )}
      </main>
    </>
  );
}
