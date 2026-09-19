// @vitest-environment jsdom
/**
 * 开源贡献页（/contributions/:username）。
 *
 * contribution-feed.test.ts 已经钉了排序和分组的规则，这里钉的是**页面真的照着那份
 * 规则画出来了**:整形函数排对了、组件却用了另一个顺序（比如自己又 sort 了一次，或者
 * 拿了 portfolio.contributions 原始数组），是这类页面最容易出的错，而且两边的测试都
 * 绿。所以这里查的是渲染结果里的顺序和文案。
 *
 * 另外钉一条立场:**未合并的 PR 必须出现在页面上**。一个只显示 merged 的贡献页看起来
 * 就是精选，而这一页的意义恰好在于它不是。这条很容易在某次「让首屏好看一点」的改动里
 * 被悄悄加个 filter 干掉。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import ContributionsPage from "../ContributionsPage.js";
import type { DeveloperPortfolio, PortfolioContribution } from "../portfolio.js";

type Row = Partial<PortfolioContribution> & { repository: string; number: number };

function pr(row: Row): PortfolioContribution {
  return {
    repositoryOwner: row.repository.split("/")[0]!,
    title: `fix: ${row.repository} #${row.number}`,
    url: `https://github.com/${row.repository}/pull/${row.number}`,
    state: "closed",
    merged: true,
    external: true,
    createdAt: "2026-09-13T00:00:00Z",
    updatedAt: "2026-09-13T00:00:00Z",
    ...row,
  };
}

/**
 * 顺序是刻意排的:google/artemis 只有 1 条但合了，noisy/repo 有 3 条但一条没合。
 * 页面必须把 artemis 放前面 —— 这就是「按合并数排，不按提交数排」在渲染层的样子。
 */
const CONTRIBUTIONS: PortfolioContribution[] = [
  pr({ repository: "google/artemis", number: 88, merged: true, createdAt: "2026-09-13T00:00:00Z" }),
  pr({ repository: "noisy/repo", number: 3, merged: false, state: "open", createdAt: "2026-09-11T00:00:00Z" }),
  pr({ repository: "noisy/repo", number: 2, merged: false, state: "open", createdAt: "2026-09-10T00:00:00Z" }),
  pr({ repository: "noisy/repo", number: 1, merged: false, state: "open", createdAt: "2026-09-09T00:00:00Z" }),
  // 关了没合。四月的，所以同时也是时间流里的第二个月份桶。
  pr({ repository: "NVIDIA-NeMo/Switchyard", number: 441, merged: false, state: "closed", createdAt: "2026-04-20T00:00:00Z" }),
  // 自己仓库里的 PR。这一页只讲提给别人的，所以它一条都不该出现。
  pr({ repository: "wellorbetter/timetrace", number: 9, merged: true, external: false }),
];

const PORTFOLIO = {
  version: 2,
  profile: { login: "wellorbetter" },
  contributions: CONTRIBUTIONS,
} as unknown as DeveloperPortfolio;

function jsonOnce(body: unknown, ok = true): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body }),
  );
}

async function render(): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  // fetch 在 effect 里发出，resolve 在微任务里 —— async act 才会把那一轮 setState
  // 也冲掉。同步 act 拿到的永远是 loading 状态。
  await act(async () => {
    createRoot(host).render(<ContributionsPage username="wellorbetter" />);
  });
  return host;
}

const texts = (host: HTMLElement, selector: string): string[] =>
  [...host.querySelectorAll(selector)].map((el) => el.textContent?.trim() ?? "");

beforeEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
});

describe("加载与失败", () => {
  it("数据回来之前显示 loader，而不是一个空页面", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    const host = document.createElement("div");
    document.body.appendChild(host);
    act(() => {
      createRoot(host).render(<ContributionsPage username="wellorbetter" />);
    });
    expect(host.querySelector(".portfolio-loader")).not.toBeNull();
    expect(host.querySelector(".feed-repo-list")).toBeNull();
  });

  it("失败时把原始错误说出来，并给一个重试", async () => {
    jsonOnce({ error: { message: "GitHub rate limit exceeded" } }, false);
    const host = await render();
    expect(host.textContent).toContain("GitHub rate limit exceeded");

    // 重试真的再发一次请求 —— 一个不重新取数的重试按钮是最让人困惑的那种坏。
    jsonOnce(PORTFOLIO);
    await act(async () => {
      host.querySelector<HTMLButtonElement>(".portfolio-state button")!.click();
    });
    expect(host.querySelector(".feed-repo-list")).not.toBeNull();
  });
});

describe("仓库排行", () => {
  it("合并数排在提交数前面", async () => {
    jsonOnce(PORTFOLIO);
    const host = await render();
    expect(texts(host, ".feed-repo-name b")).toEqual(["artemis", "repo", "Switchyard"]);
  });

  it("条形的段宽就是三类的真实条数", async () => {
    jsonOnce(PORTFOLIO);
    const host = await render();
    const fill = host.querySelectorAll(".feed-repo")[1]!.querySelector(".feed-bar-fill")!;
    const segments = [...fill.children].map((el) => [el.className, (el as HTMLElement).style.flexGrow]);
    // noisy/repo 是 3 条 open、0 merged、0 closed。为 0 的段不渲染，否则 min-width
    // 会画出一条不存在的 3px。
    expect(segments).toEqual([["is-open", "3"]]);
  });

  it("条形的长度是条数，不是每行都满格", async () => {
    // 这条钉的是第一版的错:只有分段比例、没有量，于是 1 条的仓库和 3 条的仓库画出来
    // 一样长。fixture 里最多的是 noisy/repo 的 3 条，所以它满格，1 条的占三分之一。
    jsonOnce(PORTFOLIO);
    const host = await render();
    const widths = [...host.querySelectorAll<HTMLElement>(".feed-bar-fill")].map((el) => el.style.width);
    expect(widths[0]).toBe(`${(1 / 3) * 100}%`);
    expect(widths[1]).toBe("100%");
    expect(new Set(widths).size).toBeGreaterThan(1);
  });

  it("只统计提给别人仓库的", async () => {
    jsonOnce(PORTFOLIO);
    const host = await render();
    expect(host.textContent).not.toContain("timetrace");
    expect(texts(host, ".portfolio-stat strong")[0]).toBe("5");
  });
});

describe("时间流", () => {
  it("月份新的在前，空月份不补", async () => {
    jsonOnce(PORTFOLIO);
    const host = await render();
    // 五月到八月是空的,页面上就该直接从 9 月跳到 4 月。
    expect(texts(host, ".feed-month-head h3")).toEqual(["2026 年 9 月", "2026 年 4 月"]);
  });

  it("每一条都点回真正的那个 PR", async () => {
    jsonOnce(PORTFOLIO);
    const host = await render();
    const hrefs = [...host.querySelectorAll<HTMLAnchorElement>(".feed-pr")].map((el) => el.getAttribute("href"));
    expect(hrefs).toContain("https://github.com/NVIDIA-NeMo/Switchyard/pull/441");
    expect(hrefs).toHaveLength(5);
  });
});

describe("不藏没被合并的", () => {
  it("未合并的 PR 照样在页面上，并且标着未合并", async () => {
    jsonOnce(PORTFOLIO);
    const host = await render();
    expect(host.textContent).toContain("Switchyard #441");
    expect(texts(host, ".feed-status.is-closed")).toEqual(["未合并"]);
  });

  it("顶部的数字把三类分开报，加起来等于总数", async () => {
    jsonOnce(PORTFOLIO);
    const host = await render();
    const [total, merged, open, unmerged, repos] = texts(host, ".portfolio-stat strong");
    expect([total, merged, open, unmerged, repos]).toEqual(["5", "1", "3", "1", "3"]);
    expect(Number(merged) + Number(open) + Number(unmerged)).toBe(Number(total));
  });
});

describe("空数据", () => {
  it("没有上游 PR 时说清楚，而不是画一个空壳子", async () => {
    jsonOnce({ version: 2, profile: { login: "nobody" }, contributions: [] });
    const host = await render();
    expect(host.querySelector(".feed-empty")).not.toBeNull();
    expect(host.querySelector(".feed-repo-list")).toBeNull();
    expect(host.querySelector(".feed-timeline")).toBeNull();
  });
});
