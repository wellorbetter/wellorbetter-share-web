/**
 * Tests for the feed API facade.
 *
 * Covers request construction (query params, cursor, limit),
 * error envelope parsing, and network failure handling.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFeed } from "../feedApi.js";
import type { ProjectCard } from "@wellorbetter/shared";

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function sampleCard(id: string): ProjectCard {
  return {
    id,
    slug: `slug-${id}`,
    title: `Project ${id}`,
    summary: "summary",
    coverUrl: null,
    authorId: "author-1",
    authorName: "Author",
    tags: [],
    status: "published",
    publishedAt: 1767225600000,
    createdAt: 1767225600000,
    updatedAt: 1767225600000,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchFeed request construction", () => {
  it("builds query with feed, cursor and limit", async () => {
    const fetchMock = mockFetchOnce(200, { items: [sampleCard("1")], nextCursor: "c2" });
    vi.stubGlobal("fetch", fetchMock);

    await fetchFeed({ feed: "latest", cursor: "abc", limit: 30 });

    const url = new URL(fetchMock.mock.calls[0]![0] as string, "http://localhost/");
    expect(url.searchParams.get("feed")).toBe("latest");
    expect(url.searchParams.get("cursor")).toBe("abc");
    expect(url.searchParams.get("limit")).toBe("30");
  });

  it("includes tag and authorId when provided", async () => {
    const fetchMock = mockFetchOnce(200, { items: [], nextCursor: null });
    vi.stubGlobal("fetch", fetchMock);

    await fetchFeed({ feed: "tag", tag: "flutter", authorId: "u1" });

    const url = new URL(fetchMock.mock.calls[0]![0] as string, "http://localhost/");
    expect(url.searchParams.get("tag")).toBe("flutter");
    expect(url.searchParams.get("authorId")).toBe("u1");
  });

  it("omits cursor param when cursor is null/undefined", async () => {
    const fetchMock = mockFetchOnce(200, { items: [], nextCursor: null });
    vi.stubGlobal("fetch", fetchMock);

    await fetchFeed({ feed: "random" });

    const url = new URL(fetchMock.mock.calls[0]![0] as string, "http://localhost/");
    expect(url.searchParams.has("cursor")).toBe(false);
  });

  it("forwards AbortSignal to fetch", async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init?: RequestInit) => {
      return Promise.resolve(
        new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const controller = new AbortController();
    await fetchFeed({ feed: "latest", signal: controller.signal });

    expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal);
  });
});

describe("fetchFeed error handling", () => {
  it("throws FeedApiError with code/status from error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce(429, { error: { code: "rate_limited", message: "slow down" } }),
    );

    const err = await fetchFeed({ feed: "latest" }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("rate_limited");
    expect(err.status).toBe(429);
    expect(err.message).toBe("slow down");
  });

  it("falls back to defaults when body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not json", { status: 500 })),
    );

    const err = await fetchFeed({ feed: "latest" }).catch((e) => e);
    expect(err.code).toBe("unknown");
    expect(err.status).toBe(500);
    expect(err.message).toBe("feed request failed");
  });

  it("propagates network rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));

    await expect(fetchFeed({ feed: "latest" })).rejects.toThrow("network down");
  });
});
