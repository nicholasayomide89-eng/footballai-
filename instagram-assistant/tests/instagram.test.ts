import { describe, expect, it } from "vitest";
import { GraphClient } from "@/lib/instagram/graph";
import { authorizeUrl, exchangeCode, InstagramApiError, SCOPES } from "@/lib/instagram/oauth";

type Call = { url: string; init?: RequestInit };

function fakeFetch(responses: Array<[number, unknown]>) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected request ${String(input)}`);
    return new Response(JSON.stringify(next[1]), { status: next[0], headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { impl, calls };
}

describe("oauth", () => {
  it("builds the Instagram Login authorize URL with only the needed scopes", () => {
    const url = new URL(authorizeUrl({ appId: "123", redirectUri: "https://keel.example/api/instagram/callback" }, "st4te"));
    expect(url.origin + url.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(url.searchParams.get("scope")?.split(",")).toEqual([...SCOPES]);
    expect(url.searchParams.get("state")).toBe("st4te");
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it("exchanges a code (both response shapes)", async () => {
    const cfg = { appId: "1", appSecret: "s", redirectUri: "https://x/cb", graphVersion: "v24.0" };
    const a = fakeFetch([[200, { data: [{ access_token: "T", user_id: 42, permissions: "instagram_business_basic,instagram_business_manage_messages" }] }]]);
    expect(await exchangeCode(cfg, "c", a.impl)).toEqual({ accessToken: "T", userId: "42", permissions: ["instagram_business_basic", "instagram_business_manage_messages"] });
    const b = fakeFetch([[200, { access_token: "U", user_id: "7", permissions: ["instagram_business_basic"] }]]);
    expect((await exchangeCode(cfg, "c", b.impl)).userId).toBe("7");
  });

  it("surfaces Graph API errors with codes", async () => {
    const cfg = { appId: "1", appSecret: "s", redirectUri: "https://x/cb", graphVersion: "v24.0" };
    const f = fakeFetch([[400, { error: { message: "Invalid code", code: 190 } }]]);
    const err = await exchangeCode(cfg, "bad", f.impl).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InstagramApiError);
    expect((err as InstagramApiError).isAuthError).toBe(true);
  });
});

describe("graph client", () => {
  it("sends the token in a header, never the URL", async () => {
    const f = fakeFetch([[200, { user_id: "1", username: "me" }]]);
    await new GraphClient("SECRET", "1", "v24.0", f.impl).profile();
    expect(f.calls[0]!.url).not.toContain("SECRET");
    expect((f.calls[0]!.init?.headers as Record<string, string>).Authorization).toBe("Bearer SECRET");
  });

  it("publishes a Story: container, wait for FINISHED, publish", async () => {
    const f = fakeFetch([
      [200, { id: "container1" }],
      [200, { status_code: "IN_PROGRESS" }],
      [200, { status_code: "FINISHED" }],
      [200, { id: "media99" }],
    ]);
    const id = await new GraphClient("T", "17841", "v24.0", f.impl).publishStory("https://cdn/x.jpg", "image", { pollMs: 1 });
    expect(id).toBe("media99");
    expect(f.calls[0]!.url).toBe("https://graph.instagram.com/v24.0/17841/media");
    expect(JSON.parse(String(f.calls[0]!.init?.body))).toEqual({ media_type: "STORIES", image_url: "https://cdn/x.jpg" });
    expect(f.calls[3]!.url).toBe("https://graph.instagram.com/v24.0/17841/media_publish");
    expect(JSON.parse(String(f.calls[3]!.init?.body))).toEqual({ creation_id: "container1" });
  });

  it("stops when Instagram rejects the media", async () => {
    const f = fakeFetch([[200, { id: "c" }], [200, { status_code: "ERROR", status: "bad aspect ratio" }]]);
    await expect(new GraphClient("T", "1", "v24.0", f.impl).publishStory("u", "image", { pollMs: 1 })).rejects.toThrow(/bad aspect ratio/);
  });

  it("sends a DM to the recipient IGSID", async () => {
    const f = fakeFetch([[200, { recipient_id: "999", message_id: "mid.1" }]]);
    await new GraphClient("T", "17841", "v24.0", f.impl).sendText("999", "hey");
    expect(JSON.parse(String(f.calls[0]!.init?.body))).toEqual({ recipient: { id: "999" }, message: { text: "hey" } });
  });
});
