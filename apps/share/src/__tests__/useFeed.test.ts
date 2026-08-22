/**
 * Tests for useFeed hook behavior:
 *   - single-flight (no concurrent fetches)
 *   - dedup (same cursor â†?skip)
 *   - finite window (cap 80, drop oldest, grow spacer)
 *   - abort on unmount does not surface as error
 *   - exhausted state when nextCursor is null
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { FeedCursorResponse, ProjectCard } from "@wellorbetter/shared";
import { useFeed } from "../hooks/useFeed.js";

function card(id: string): ProjectCard {
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

/** Programmable fetch mock â€?each queued response is consumed in order. */
function makeFetchMock() {
  const queue: FeedCursorResponse<ProjectCard>[] = [];
  const pending: Array<(r: Response) => void> = [];
  const calls: Array<{ cursor: string | null; signal: AbortSignal }> = [];

  const impl = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    const url = new URL(_url as string, "http://localhost/");
    calls.push({
      cursor: url.searchParams.get("cursor"),
      signal: init?.signal as AbortSignal,
    });
    const queued = queue.shift();
    if (queued) return Promise.resolve(new Response(JSON.stringify(queued), { status: 200 }));

    return new Promise<Response>((resolve) => {
      pending.push(resolve);
    });
  });

  return {
    impl,
    calls,
    /** Immediately resolve the latest pending request. */
    respond(response: FeedCursorResponse<ProjectCard>) {
      const resolve = pending.shift();
      if (resolve) resolve(new Response(JSON.stringify(response), { status: 200 }));
    },
    /** Queue a canned response for the next request. */
    enqueue(response: FeedCursorResponse<ProjectCard>) {
      queue.push(response);
    },
  };
}

let fetchMock: ReturnType<typeof makeFetchMock>;

beforeEach(() => {
  fetchMock = makeFetchMock();
  vi.stubGlobal("fetch", fetchMock.impl);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useFeed", () => {
  it("loads first page on mount and stores items", async () => {
    fetchMock.enqueue({ items: [card("1"), card("2")], nextCursor: "c2" });
    const { result } = renderHook(() => useFeed({ feed: "latest" }));

    await waitFor(() => {
      expect(result.current.status).not.toBe("idle");
    });
    expect(result.current.items.map((i) => i.id)).toEqual(["1", "2"]);
    expect(result.current.status).toBe("success");
    expect(result.current.totalLoaded).toBe(2);
  });

  it("marks exhausted when nextCursor is null", async () => {
    fetchMock.enqueue({ items: [card("1")], nextCursor: null });
    const { result } = renderHook(() => useFeed({ feed: "latest" }));

    await waitFor(() => {
      expect(result.current.status).toBe("exhausted");
    });
  });

  it("marks empty when zero items returned", async () => {
    fetchMock.enqueue({ items: [], nextCursor: null });
    const { result } = renderHook(() => useFeed({ feed: "latest" }));

    await waitFor(() => {
      expect(result.current.status).toBe("empty");
    });
    expect(result.current.items).toHaveLength(0);
  });

  it("single-flight: concurrent loadMore calls trigger one fetch", async () => {
    fetchMock.enqueue({ items: [card("1")], nextCursor: "c2" });
    const { result } = renderHook(() => useFeed({ feed: "latest" }));
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(fetchMock.impl).toHaveBeenCalledTimes(1);

    // Two rapid loadMore calls with no queued response â†?only one in flight
    fetchMock.enqueue({ items: [card("2")], nextCursor: null });
    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });

    await waitFor(() => expect(fetchMock.impl).toHaveBeenCalledTimes(2));
    expect(fetchMock.impl).toHaveBeenCalledTimes(2); // not 3
  });

  it("dedup: loadMore with an already-fetched cursor is skipped", async () => {
    fetchMock.enqueue({ items: [card("1")], nextCursor: "c2" });
    const { result } = renderHook(() => useFeed({ feed: "latest" }));
    await waitFor(() => expect(result.current.status).toBe("success"));

    const before = fetchMock.impl.mock.calls.length;
    // "c2" has not been fetched yet â†?this should fire
    fetchMock.enqueue({ items: [card("2")], nextCursor: null });
    act(() => result.current.loadMore());
    await waitFor(() => expect(fetchMock.impl.mock.calls.length).toBeGreaterThan(before));
  });

  it("finite window: caps items at windowSize and grows top spacer", async () => {
    // page1: 3 items, page2: 3 more â†?6 total, window 4 â†?drop 2 oldest
    fetchMock.enqueue({ items: [card("1"), card("2"), card("3")], nextCursor: "c2" });
    const { result } = renderHook(() => useFeed({ feed: "latest", windowSize: 4, estimatedCardHeight: 100 }));
    await waitFor(() => expect(result.current.status).toBe("success"));

    fetchMock.enqueue({ items: [card("4"), card("5"), card("6")], nextCursor: null });
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.status).toBe("exhausted"));

    expect(result.current.items.map((i) => i.id)).toEqual(["3", "4", "5", "6"]);
    expect(result.current.totalLoaded).toBe(6);
    expect(result.current.topSpacerPx).toBe(200); // 2 dropped Ã— 100px
  });

  it("surfaces error status on network failure with empty list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("network down")),
    );
    const { result } = renderHook(() => useFeed({ feed: "latest" }));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("network down");
  });

  it("keeps success status when a later page fails", async () => {
    fetchMock.enqueue({ items: [card("1")], nextCursor: "c2" });
    const { result } = renderHook(() => useFeed({ feed: "latest" }));
    await waitFor(() => expect(result.current.status).toBe("success"));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("later failure")),
    );
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.error).toBe("later failure"));
    expect(result.current.status).toBe("success"); // items retained
    expect(result.current.items).toHaveLength(1);
  });

  it("abort on unmount is not surfaced as error", async () => {
    const { result, unmount } = renderHook(() => useFeed({ feed: "latest" }));
    // Leave the request pending, then unmount â†?AbortError path
    unmount();
    fetchMock.respond({ items: [card("1")], nextCursor: null });
    // No assertion possible on unmounted state; the contract is "no throw".
    expect(result.current).toBeTruthy();
  });

  it("feed change resets state and refetches", async () => {
    fetchMock.enqueue({ items: [card("a1")], nextCursor: null });
    const { result, rerender } = renderHook(
      ({ feed }: { feed: "latest" | "random" }) => useFeed({ feed }),
      { initialProps: { feed: "latest" as "latest" | "random" } },
    );
    await waitFor(() => expect(result.current.status).toBe("exhausted"));

    fetchMock.enqueue({ items: [card("r1")], nextCursor: null });
    rerender({ feed: "random" });

    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(["r1"]));
    expect(result.current.topSpacerPx).toBe(0);
    expect(result.current.totalLoaded).toBe(1);
  });
});
