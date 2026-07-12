import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  getBagsCreatorProfile,
  isBagsApiConfigured,
  pingBagsApi,
  resetBagsProfileCacheForTests,
} from "../services/bagsApi.js";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.BAGS_FM_API_KEY;

describe("bagsApi", () => {
  beforeEach(() => {
    resetBagsProfileCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.BAGS_FM_API_KEY;
    } else {
      process.env.BAGS_FM_API_KEY = originalApiKey;
    }
  });

  it("reports unconfigured when API key is missing", () => {
    delete process.env.BAGS_FM_API_KEY;
    assert.equal(isBagsApiConfigured(), false);
  });

  it("maps creator profile from /auth/me", async () => {
    process.env.BAGS_FM_API_KEY = "test-key";

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/ping")) {
        return new Response(JSON.stringify({ message: "pong" }), { status: 200 });
      }
      assert.match(url, /\/auth\/me$/);
      return new Response(
        JSON.stringify({
          success: true,
          response: {
            user: {
              username: "orbitsolanacasino",
              pref_name: "Orbit Solana Casino",
              picture: "https://example.com/pfp.png",
              ticker: "ORBIT",
            },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const profile = await getBagsCreatorProfile();
    assert.ok(profile);
    assert.equal(profile.username, "orbitsolanacasino");
    assert.equal(profile.displayName, "Orbit Solana Casino");
    assert.equal(profile.profileUrl, "https://bags.fm/@orbitsolanacasino");
  });

  it("pingBagsApi returns true on pong", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "pong" }), { status: 200 })) as typeof fetch;
    assert.equal(await pingBagsApi(), true);
  });
});
