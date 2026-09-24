export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { error } = await searchParams;
  return (
    <main className="shell" style={{ padding: "48px 16px", gap: 20, maxWidth: 420 }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 30 }}>Keel</p>
      <h1>Sign in</h1>
      <p className="muted">This is your Keel password, not your Instagram password. Keel never asks for that.</p>
      {error ? (
        <p className="banner error" role="alert">
          {error === "locked" ? "Too many attempts. Try again in 15 minutes." : "That password didn't work."}
        </p>
      ) : null}
      <form method="post" action="/api/auth/login" className="stack" style={{ gap: 14 }}>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required minLength={12} />
        </div>
        <button className="btn primary block" type="submit">Sign in</button>
      </form>
    </main>
  );
}
