/**
 * createSiteSpec —— 确定性基线 SiteSpec。
 *
 * 这个文件之前一条测试都没有，而它是**每一个没开 AI 的访客看到的那份主页**：模型那条路
 * 失败时（askForSpec 返回 null）也回落到它。所以它值得被钉住。
 *
 * 这里钉的核心是一条立场：**卡片上不能有两行说同一件事**。原来 whyItMatters 是
 * `item.merged ? "已合并到上游" : …` 三选一，而渲染出来的卡片上方已经有个徽章印着
 * 「已合并」—— 于是三行里两行重复。改成留空之后，这个测试防的是有人觉得"这个字段空着
 * 不好看"又把状态词填回去。
 *
 * 为什么不能填点别的:PortfolioContribution 里只有 repo / number / title / state / 两个
 * 时间戳（portfolio.ts:16-27），BFF 从 /search/issues 拼数据，不带 PR 正文。要写出一句
 * 有内容的话，素材得从别处来 —— 那是 PR digest 管道的事。
 */

import { describe, expect, it } from "vitest";
import { createSiteSpec, validateSiteSpec } from "../site-spec.js";
import type { DeveloperPortfolio, PortfolioContribution } from "../portfolio.js";

function pr(row: Partial<PortfolioContribution> & { repository: string; number: number }): PortfolioContribution {
  return {
    repositoryOwner: row.repository.split("/")[0]!,
    title: `fix: ${row.repository} #${row.number}`,
    url: `https://github.com/${row.repository}/pull/${row.number}`,
    state: "closed",
    merged: true,
    external: true,
    createdAt: "2026-04-03T00:00:00Z",
    updatedAt: "2026-04-08T00:00:00Z",
    ...row,
  };
}

/** 三种状态各一条，外加一条自己仓库的 —— 覆盖 whyItMatters 原来那三个分支。 */
const PORTFOLIO = {
  version: 2,
  profile: {
    login: "wellorbetter",
    name: "Well or Better",
    avatarUrl: "https://example.test/a.png",
    githubUrl: "https://github.com/wellorbetter",
    bio: null,
    company: null,
    location: null,
    website: null,
    joinedAt: "2020-01-01T00:00:00Z",
  },
  stats: {
    publicRepos: 10, sourceRepos: 8, stars: 40, followers: 3,
    pullRequests: 60, mergedPullRequests: 30, externalPullRequests: 50, externalMergedPullRequests: 26,
  },
  languages: [{ name: "TypeScript", repos: 5 }],
  projects: [
    { name: "timetrace", fullName: "wellorbetter/timetrace", url: "https://github.com/wellorbetter/timetrace", description: "Time tracking.", homepage: null, language: "Rust", topics: ["cli"], stars: 20, forks: 2, openIssues: 1, license: null, updatedAt: "2026-09-01T00:00:00Z" },
    { name: "cxs", fullName: "wellorbetter/cxs", url: "https://github.com/wellorbetter/cxs", description: "Codex sessions.", homepage: null, language: "Rust", topics: ["cli"], stars: 9, forks: 0, openIssues: 0, license: null, updatedAt: "2026-08-01T00:00:00Z" },
  ],
  contributions: [
    pr({ repository: "google/artemis", number: 46, merged: true, state: "closed" }),
    pr({ repository: "noisy/repo", number: 3, merged: false, state: "open" }),
    pr({ repository: "NVIDIA-NeMo/Switchyard", number: 441, merged: false, state: "closed" }),
    pr({ repository: "wellorbetter/timetrace", number: 9, merged: true, external: false }),
  ],
  activity: null,
  generatedAt: "2026-09-19T00:00:00Z",
} satisfies DeveloperPortfolio;

describe("贡献条目不重复徽章", () => {
  /** 徽章上印的那几个词（SiteRenderer.tsx:11-12 的 copy 表）。 */
  const BADGE_WORDS = ["已合并", "进行中", "已关闭", "MERGED", "OPEN", "CLOSED", "Merged upstream", "Active upstream"];

  for (const locale of ["zh", "en"] as const) {
    it(`${locale}:whyItMatters 里不出现状态词`, () => {
      const spec = createSiteSpec(PORTFOLIO, "", locale);
      expect(spec.contributions.length).toBeGreaterThan(0);
      for (const entry of spec.contributions) {
        for (const word of BADGE_WORDS) {
          expect(entry.whyItMatters).not.toContain(word);
        }
      }
    });
  }

  it("三种状态一律留空，不是只有 merged 那一档留空", () => {
    // 分状态给不同填充话是这个字段原来的样子。留空必须是一致的，否则卡片之间
    // 会出现"有的有第三行、有的没有"的高度抖动。
    const spec = createSiteSpec(PORTFOLIO, "", "zh");
    expect(spec.contributions.map((entry) => entry.whyItMatters)).toEqual(
      spec.contributions.map(() => ""),
    );
  });

  it("留空之后这份 spec 依然是合法的", () => {
    // 留空要真的能走完 AI 那条路上的校验链，否则基线自己就是一份非法 spec。
    const spec = createSiteSpec(PORTFOLIO, "", "zh");
    expect(validateSiteSpec(spec, PORTFOLIO)).toEqual([]);
  });
});

describe("基线策展", () => {
  it("只选提给别人仓库的 PR", () => {
    // 自己仓库里的 PR 不是"开源贡献"叙事的一部分,而且它已经在 projects 里出现过了。
    const spec = createSiteSpec(PORTFOLIO, "", "zh");
    expect(spec.contributions.map((entry) => entry.key)).not.toContain("wellorbetter/timetrace#9");
    expect(spec.contributions).toHaveLength(3);
  });

  it("没被合并的照样选进来", () => {
    // 和 /contributions 页同一条立场:只显示 merged 的话这一段就变成精选。
    const spec = createSiteSpec(PORTFOLIO, "", "zh");
    expect(spec.contributions.map((entry) => entry.key)).toContain("NVIDIA-NeMo/Switchyard#441");
  });

  it("headline 是 PR 原标题,不是改写过的句子", () => {
    // 这一段的意义是可验证 —— 标题必须和点进去看到的那个 PR 一致。
    const spec = createSiteSpec(PORTFOLIO, "", "zh");
    const entry = spec.contributions.find((item) => item.key === "google/artemis#46")!;
    expect(entry.headline).toBe("fix: google/artemis #46");
  });
});
