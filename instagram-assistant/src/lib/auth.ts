import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "./env";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export async function isOwner(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value, env().SESSION_SECRET);
}

/** For server components: redirect to /login when not signed in. */
export async function requireOwnerPage(): Promise<void> {
  if (!(await isOwner())) redirect("/login");
}

/** For route handlers: returns a 401 response when not signed in, else null. */
export async function requireOwnerApi(): Promise<Response | null> {
  if (await isOwner()) return null;
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
