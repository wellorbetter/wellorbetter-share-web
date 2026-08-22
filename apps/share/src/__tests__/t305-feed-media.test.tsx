/**
 * Tests for T305 additions:
 *  - decideRootMargin network-aware prefetch decision
 *  - FeedCard media fallback (image error → placeholder, video → poster placeholder)
 *  - FeedStatus auth-aware empty state
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { decideRootMargin } from "../lib/connection.js";
import { FeedCard } from "../components/FeedCard.js";
import { FeedStatus } from "../components/FeedStatus.js";
import type { ProjectCard } from "@wellorbetter/shared";

function card(overrides: Partial<ProjectCard> = {}): ProjectCard {
  return {
    id: "p1",
    slug: "p1",
    title: "Project",
    summary: "s",
    authorId: "a1",
    authorName: "Author",
    coverUrl: "https://cdn.example.com/cover.webp",
    tags: [],
    status: "published",
    publishedAt: 1767225600000,
    createdAt: 1767225600000,
    updatedAt: 1767225600000,
    ...overrides,
  };
}

describe("decideRootMargin", () => {
  it("returns default margin with no connection info", () => {
    expect(decideRootMargin(undefined)).toBe("200% 0%");
    expect(decideRootMargin(null)).toBe("200% 0%");
  });

  it("returns default margin on fast connections", () => {
    expect(decideRootMargin({ effectiveType: "4g" })).toBe("200% 0%");
  });

  it("reduces margin when saveData is on", () => {
    expect(decideRootMargin({ saveData: true, effectiveType: "4g" })).toBe("100% 0%");
  });

  it("reduces margin on slow effective types", () => {
    expect(decideRootMargin({ effectiveType: "2g" })).toBe("100% 0%");
    expect(decideRootMargin({ effectiveType: "slow-2g" })).toBe("100% 0%");
    expect(decideRootMargin({ effectiveType: "3g" })).toBe("100% 0%");
  });

  it("ignores explicit saveData: false", () => {
    expect(decideRootMargin({ saveData: false, effectiveType: "4g" })).toBe("200% 0%");
  });
});

describe("FeedCard media strategy", () => {
  it("renders lazy image for image covers", () => {
    const { container } = render(<FeedCard card={card()} />);
    const img = container.querySelector("img.feed-card-img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("loading")).toBe("lazy");
    expect(img!.getAttribute("decoding")).toBe("async");
  });

  it("falls back to placeholder when image fails to load", () => {
    const { container } = render(<FeedCard card={card()} />);
    const img = container.querySelector("img.feed-card-img")!;
    fireEvent.error(img);
    expect(container.querySelector("img.feed-card-img")).toBeNull();
    expect(container.querySelector(".feed-card-placeholder")).not.toBeNull();
  });

  it("renders poster placeholder (no img/video) for video covers", () => {
    const { container } = render(
      <FeedCard card={card({ coverUrl: "https://cdn.example.com/clip.mp4" })} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
    const ph = container.querySelector(".feed-card-placeholder--video");
    expect(ph).not.toBeNull();
    expect(ph!.getAttribute("role")).toBe("img");
  });

  it("treats query-suffixed video URLs as video", () => {
    const { container } = render(
      <FeedCard card={card({ coverUrl: "https://cdn.example.com/clip.webm?x=1" })} />,
    );
    expect(container.querySelector(".feed-card-placeholder--video")).not.toBeNull();
  });

  it("renders neutral placeholder when coverUrl is null", () => {
    const { container } = render(<FeedCard card={card({ coverUrl: null })} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".feed-card-placeholder")).not.toBeNull();
    expect(container.querySelector(".feed-card-placeholder--video")).toBeNull();
  });
});

describe("FeedStatus empty state", () => {
  it("shows publish CTA when authed", () => {
    const onPublish = vi.fn();
    render(
      <FeedStatus status="empty" error={null} isAuthed={true} onPublish={onPublish} />,
    );
    const btn = screen.getByRole("button", { name: "发布第一个作品" });
    fireEvent.click(btn);
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it("shows login CTA when anonymous", () => {
    const onLogin = vi.fn();
    render(
      <FeedStatus status="empty" error={null} isAuthed={false} onLogin={onLogin} />,
    );
    const btn = screen.getByRole("button", { name: "登录并发布作品" });
    fireEvent.click(btn);
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it("renders skeleton grid while loading", () => {
    const { container } = render(<FeedStatus status="loading" error={null} />);
    expect(container.querySelectorAll(".feed-skeleton-card")).toHaveLength(6);
  });

  it("renders retry button on error", () => {
    const onRetry = vi.fn();
    render(<FeedStatus status="error" error="boom" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
