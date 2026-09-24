/** Success / error banner driven by ?saved, ?sent, ?error query params. */
export function Flash({ params }: { params: Record<string, string | string[] | undefined> }) {
  const error = typeof params.error === "string" ? params.error : undefined;
  const ok = ["saved", "sent", "published", "connected", "disconnected"].find((k) => params[k]);
  const okText: Record<string, string> = {
    saved: "Saved.",
    sent: "Sent.",
    published: "Published to your Story.",
    connected: "Instagram connected.",
    disconnected: "Instagram disconnected and its data deleted.",
  };
  if (error) return <p className="banner error" role="alert">{error}</p>;
  if (ok) return <p className="banner ok" role="status">{okText[ok]}</p>;
  return null;
}
