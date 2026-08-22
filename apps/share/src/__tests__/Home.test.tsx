/**
 * Integration tests for HomePage (T005).
 *
 * Covers:
 * - Home page renders without FeedTabs
 * - Feed defaults to "latest" (fetch URL includes feed=latest)
 * - Masonry renders with FeedCard items
 * - Empty state renders when feed has 0 items
 * - Loading state renders initially
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { HomePage } from "../pages/Home.js";
import type { FeedCursorResponse, ProjectCard } from "@wellorbetter/shared";

// ---------- IntersectionObserver mock (jsdom does not implement it) ----------

class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
}

// ---------- helpers ----------

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

function feedResponse(items: ProjectCard[], nextCursor: string | null = null): FeedCursorResponse<ProjectCard> {
  return { items, nextCursor };
}

let fetchCalls: Array<{ url: string; init?: RequestInit }> = [];

function mockFetch(responses: FeedCursorResponse<ProjectCard>[]) {
  let idx = 0;
  const impl = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    fetchCalls.push({ url, init });
    const res = responses[idx];
    idx++;
    if (res) {
      return Promise.resolve(new Response(JSON.stringify(res), { status: 200 }));
    }
    // If no more queued responses, return empty
    return Promise.resolve(
      new Response(JSON.stringify(feedResponse([])), { status: 200 }),
    );
  });
  vi.stubGlobal("fetch", impl);
}

beforeEach(() => {
  fetchCalls = [];
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver as unknown as typeof IntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

// ---------- tests ----------

describe("HomePage integration", () => {
  it("renders loading state initially", () => {
    // fetch never resolves → stays in loading
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    render(<HomePage />);
    // FeedStatus renders skeleton when status is "loading"
    expect(document.querySelector(".feed-skeleton-card")).not.toBeNull();
  });

  it("fetches feed=latest by default (not random/tag/author)", async () => {
    mockFetch([feedResponse([card("1")])]);
    render(<HomePage />);

    await waitFor(() => {
      expect(fetchCalls.length).toBeGreaterThan(0);
    });

    // First fetch call should include feed=latest
    const firstUrl = fetchCalls[0]!.url;
    expect(firstUrl).toContain("/api/projects");
    expect(firstUrl).toContain("feed=latest");
    // Should NOT contain feed=random, feed=tag, or feed=author
    expect(firstUrl).not.toContain("feed=random");
    expect(firstUrl).not.toContain("feed=tag");
    expect(firstUrl).not.toContain("feed=author");
  });

  it("renders FeedCard items in masonry layout", async () => {
    const items = [card("1"), card("2"), card("3")];
    mockFetch([feedResponse(items)]);
    render(<HomePage />);

    await waitFor(() => {
      // Each card should render with data-project-id attribute
      expect(document.querySelector('[data-project-id="1"]')).not.toBeNull();
      expect(document.querySelector('[data-project-id="2"]')).not.toBeNull();
      expect(document.querySelector('[data-project-id="3"]')).not.toBeNull();
    });
  });

  it("does NOT render FeedTabs component", async () => {
    mockFetch([feedResponse([card("1")])]);
    render(<HomePage />);

    await waitFor(() => {
      expect(document.querySelector('[data-project-id="1"]')).not.toBeNull();
    });

    // FeedTabs would render tab buttons like "最新", "随机", "标签", "作者" etc.
    // These should not be present in the current simplified home page
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("renders empty state when feed has 0 items", async () => {
    mockFetch([feedResponse([])]);
    const onLogin = vi.fn();
    render(<HomePage isAuthed={false} onLogin={onLogin} />);

    await waitFor(() => {
      // Empty state should show a message and login CTA
      expect(screen.getByRole("button", { name: "登录并发布作品" })).toBeTruthy();
    });
  });

  it("renders empty state with publish CTA when authed", async () => {
    mockFetch([feedResponse([])]);
    const onPublish = vi.fn();
    render(<HomePage isAuthed={true} onPublish={onPublish} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "发布第一个作品" })).toBeTruthy();
    });
  });

  it("masonry container is present when items are loaded", async () => {
    mockFetch([feedResponse([card("1"), card("2")])]);
    render(<HomePage />);

    await waitFor(() => {
      expect(document.querySelector(".masonry-container")).not.toBeNull();
      expect(document.querySelector(".masonry-grid")).not.toBeNull();
    });
  });

  it("calls onOpenProject when a card is clicked", async () => {
    const onOpen = vi.fn();
    mockFetch([feedResponse([card("abc")])]);
    render(<HomePage onOpenProject={onOpen} />);

    await waitFor(() => {
      expect(document.querySelector('[data-project-id="abc"]')).not.toBeNull();
    });

    // Click the card button
    const cardButton = screen.getByRole("button", { name: "查看 Project abc" });
    cardButton.click();
    expect(onOpen).toHaveBeenCalledWith("slug-abc");
  });
});
