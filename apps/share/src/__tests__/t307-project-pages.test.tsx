/**
 * Tests for T307: projectApi request construction, StatusBadge,
 * Publish form validation, FeedCard open callback.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { projectApi } from "../projectApi.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { FeedCard } from "../components/FeedCard.js";
import { PublishPage } from "../pages/Publish.js";
import type { ProjectCard } from "@wellorbetter/shared";

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

function card(overrides: Partial<ProjectCard> = {}): ProjectCard {
  return {
    id: "p1",
    slug: "my-app",
    title: "My App",
    summary: "s",
    authorId: "a1",
    authorName: "Author",
    coverUrl: null,
    tags: [],
    status: "published",
    publishedAt: 1767225600000,
    createdAt: 1767225600000,
    updatedAt: 1767225600000,
    ...overrides,
  };
}

describe("projectApi request construction", () => {
  it("create posts to /api/projects with JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "1", slug: "x", title: "t", summary: "", status: "draft", updatedAt: 1 }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await projectApi.create({ title: "T", summary: "S" });

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toContain("/api/projects");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ title: "T", summary: "S" });
  });

  it("publish posts to /api/projects/:id/publish", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await projectApi.publish("abc");
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toContain("/api/projects/abc/publish");
    expect(init.method).toBe("POST");
  });

  it("listMine appends status query param", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await projectApi.listMine({ status: "draft", limit: 10 });
    const url = new URL(fetchMock.mock.calls[0]![0] as string, "http://localhost/");
    expect(url.searchParams.get("status")).toBe("draft");
    expect(url.searchParams.get("limit")).toBe("10");
  });

  it("detail fetches by slug", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ card: {}, versions: [], media: [], vibeNotes: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await projectApi.detail("my-app");
    expect(fetchMock.mock.calls[0]![0]).toContain("/api/projects/my-app");
  });

  it("report posts reason and description", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await projectApi.report("p1", { reason: "malware", description: "bad" });
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toContain("/api/projects/p1/report");
    expect(JSON.parse(init.body as string)).toEqual({ reason: "malware", description: "bad" });
  });

  it("mediaRequest posts type/contentType/fileSize", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ mediaId: "m1", presignedUrl: "https://r2/put", expiresAt: 1 }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await projectApi.mediaRequest("p1", { type: "cover", contentType: "image/png", fileSize: 1024 });
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toContain("/api/projects/p1/media");
    expect(JSON.parse(init.body as string)).toEqual({ type: "cover", contentType: "image/png", fileSize: 1024 });
  });
});

describe("StatusBadge", () => {
  it.each([
    ["draft", "草稿"],
    ["pending_media", "待补媒体"],
    ["published", "已发布"],
    ["rejected", "被拒"],
    ["hidden", "已隐藏"],
    ["removed", "已删除"],
  ] as const)("renders %s as %s", (status, label) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(container.querySelector(`.status-badge--${status}`)).not.toBeNull();
    expect(screen.getByText(label)).toBeTruthy();
  });
});

describe("FeedCard onOpen", () => {
  it("invokes onOpen with slug when clicked", () => {
    const onOpen = vi.fn();
    render(<FeedCard card={card()} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "查看 My App" }));
    expect(onOpen).toHaveBeenCalledWith("my-app");
  });
});

describe("PublishPage validation", () => {
  function renderPublish() {
    return render(<PublishPage />);
  }

  it("blocks submit when title empty", () => {
    renderPublish();
    const submit = screen.getByRole("button", { name: "保存并发布" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("requires https URL when release kind is web", async () => {
    renderPublish();
    fireEvent.change(screen.getByPlaceholderText("例如：桌面宠物 Chocola"), {
      target: { value: "Test App" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Web 应用链接/ }));
    fireEvent.change(screen.getByPlaceholderText(/github\.com/), {
      target: { value: "http://insecure.example.com" },
    });

    const submit = screen.getByRole("button", { name: "保存并发布" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getByText("仅支持 https:// 链接")).toBeTruthy();
  });

  it("accepts valid title + summary", () => {
    renderPublish();
    fireEvent.change(screen.getByPlaceholderText("例如：桌面宠物 Chocola"), {
      target: { value: "Test App" },
    });
    const submit = screen.getByRole("button", { name: "保存并发布" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });
});
