import { describe, expect, it } from "vitest";
import { HttpError, PoliteFetcher } from "../src/http/fetcher.js";

/** A server that rejects conditional requests with `status` but serves the page normally otherwise. */
function server(status: number) {
  const seen: Record<string, string>[] = [];
  const fetchImpl = (async (_url: string, init: { headers: Record<string, string> }) => {
    seen.push(init.headers);
    const conditional = "if-none-match" in init.headers || "if-modified-since" in init.headers;
    return new Response(conditional ? "nope" : "<html>jobs</html>", { status: conditional ? status : 200 });
  }) as unknown as never;
  return { seen, fetcher: new PoliteFetcher({ minDelayMs: 0, maxDelayMs: 0, retries: 0, respectRobots: false, fetchImpl }) };
}

describe("PoliteFetcher conditional requests", () => {
  it("retries once without If-None-Match / If-Modified-Since when a server rejects them with a 4xx", async () => {
    for (const status of [403, 422]) {
      const { seen, fetcher } = server(status);
      const r = await fetcher.get("https://example.com/careers", {
        validators: { etag: '"abc"', lastModified: "Wed, 18 Nov 2026 00:00:00 GMT" },
      });
      expect(r.text).toBe("<html>jobs</html>");
      expect(seen).toHaveLength(2);
      expect(seen[1]).not.toHaveProperty("if-none-match");
    }
  });

  it("does not retry a 404, or a 4xx without validators", async () => {
    const { seen, fetcher } = server(404);
    await expect(fetcher.get("https://example.com/gone", { validators: { etag: '"abc"' } })).rejects.toBeInstanceOf(HttpError);
    expect(seen).toHaveLength(1);
  });
});
