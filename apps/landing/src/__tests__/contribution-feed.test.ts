/**
 * 贡献 feed 的数据整形。
 *
 * 这个文件里钉的几乎全是**排序和分组的判断**,因为那是这个 feed 唯一会悄悄出错的
 * 地方:排错了不会报错,只会让页面讲一个稍微不对的故事。
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  contributionStatus,
  externalContributions,
  feedSummary,
  groupByMonth,
  groupByRepository,
  repositoryUrl,
} from "../contribution-feed.js";
import type { DeveloperPortfolio, PortfolioContribution } from "../portfolio.js";

let pr = 0;
function contribution(over: Partial<PortfolioContribution> = {}): PortfolioContribution {
  const repository = over.repository ?? "acme/widget";
  const number = over.number ?? ++pr;
  return {
    repository,
    repositoryOwner: repository.split("/")[0]!,
    number,
    title: `fix: thing ${number}`,
    url: `https://github.com/${repository}/pull/${number}`,
    state: "closed",
    merged: true,
    external: true,
    createdAt: "2026-04-10T00:00:00Z",
    updatedAt: "2026-04-10T00:00:00Z",
    ...over,
  };
}

describe("状态", () => {
  it("merged / open / 提了没被接受,是三件事", () => {
    expect(contributionStatus(contribution({ merged: true, state: "closed" }))).toBe("merged");
    expect(contributionStatus(contribution({ merged: false, state: "open" }))).toBe("open");
    // 关了但没合 = 提了没被接受。这一类照样要显示,不能塌进 "closed" 一律当成功。
    expect(contributionStatus(contribution({ merged: false, state: "closed" }))).toBe("closed");
  });
});

describe("仓库主页链接", () => {
  it("从 PR 链接砍出仓库页", () => {
    expect(repositoryUrl(contribution({ repository: "LawnchairLauncher/lawnchair", number: 6653 })))
      .toBe("https://github.com/LawnchairLauncher/lawnchair");
  });

  it("链接形状不认识就退回 owner/name 拼出来的", () => {
    expect(repositoryUrl(contribution({ repository: "microsoft/mxc", url: "https://example.invalid/x" })))
      .toBe("https://github.com/microsoft/mxc");
  });
});

describe("按仓库分组", () => {
  it("merged 数优先于总数", () => {
    // "提 3 条合 3 条" 要排在 "提 9 条合 0 条" 前面 —— 被接受过比提得多更说明问题。
    const items = [
      ...Array.from({ length: 9 }, () => contribution({ repository: "noisy/repo", merged: false, state: "open" })),
      ...Array.from({ length: 3 }, () => contribution({ repository: "trusted/repo", merged: true })),
    ];
    expect(groupByRepository(items).map((g) => g.repository)).toEqual(["trusted/repo", "noisy/repo"]);
  });

  it("merged 相同就比总数", () => {
    const items = [
      contribution({ repository: "a/one", merged: true }),
      contribution({ repository: "b/two", merged: true }),
      contribution({ repository: "b/two", merged: false, state: "open" }),
    ];
    expect(groupByRepository(items).map((g) => g.repository)).toEqual(["b/two", "a/one"]);
  });

  it("三个计数分得清,而且加起来等于总数", () => {
    const items = [
      contribution({ repository: "x/y", merged: true }),
      contribution({ repository: "x/y", merged: true }),
      contribution({ repository: "x/y", merged: false, state: "open" }),
      contribution({ repository: "x/y", merged: false, state: "closed" }),
    ];
    const group = groupByRepository(items)[0]!;
    expect(group).toMatchObject({ total: 4, merged: 2, open: 1, closed: 1 });
    expect(group.merged + group.open + group.closed).toBe(group.total);
  });

  it("记住这个仓库的活动区间", () => {
    const items = [
      contribution({ repository: "x/y", createdAt: "2026-03-28T10:00:00Z" }),
      contribution({ repository: "x/y", createdAt: "2026-05-11T10:00:00Z" }),
      contribution({ repository: "x/y", createdAt: "2026-04-02T10:00:00Z" }),
    ];
    expect(groupByRepository(items)[0]!).toMatchObject({ firstAt: "2026-03-28", lastAt: "2026-05-11" });
  });

  it("组内新的在前,同一天用 PR 号兜底", () => {
    // 兜底不是洁癖:GitHub 同一天提的 PR 时间戳可能一样,没有第二个键的话顺序取决于
    // Array.sort 的实现细节,页面每次刷新都可能不一样。
    const items = [
      contribution({ repository: "x/y", number: 10, createdAt: "2026-04-10T00:00:00Z" }),
      contribution({ repository: "x/y", number: 30, createdAt: "2026-04-10T00:00:00Z" }),
      contribution({ repository: "x/y", number: 20, createdAt: "2026-04-11T00:00:00Z" }),
    ];
    expect(groupByRepository(items)[0]!.items.map((i) => i.number)).toEqual([20, 30, 10]);
  });
});

describe("按月分组", () => {
  // 用 vi.stubEnv 而不是直接写 process.env:这个 app 的 tsconfig 只带 vite/client,
  // 没有 @types/node,process 在这里没有类型。stubEnv 改的是同一个 process.env,
  // 但有类型,而且 unstubAllEnvs 会还原 —— 时区泄漏到别的测试文件很难查。
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("新的月份在前", () => {
    const items = [
      contribution({ createdAt: "2026-03-05T00:00:00Z" }),
      contribution({ createdAt: "2026-09-13T00:00:00Z" }),
      contribution({ createdAt: "2026-04-20T00:00:00Z" }),
    ];
    expect(groupByMonth(items).map((b) => b.month)).toEqual(["2026-09", "2026-04", "2026-03"]);
  });

  it("空月份不补", () => {
    // 真实数据里 6、7 月是空的,而那段空白本身是信息（从 Android 转到 AI 基础设施之
    // 间的停顿)。补成 0 会画出一条没意义的零线,还把跳跃藏起来。
    const items = [
      contribution({ createdAt: "2026-05-11T00:00:00Z" }),
      contribution({ createdAt: "2026-08-15T00:00:00Z" }),
    ];
    expect(groupByMonth(items).map((b) => b.month)).toEqual(["2026-08", "2026-05"]);
  });

  it("换时区不会把 PR 挪到别的月份", () => {
    // 这条是这个文件里最重要的一条。createdAt 是 ISO UTC,而 new Date(x).getMonth()
    // 用的是**本地时区** —— 一条 04-01T02:00Z 的 PR 对 UTC-11 的访客会落进 3 月。
    // 同一个页面在不同时区讲不同的故事,而且没有任何地方会报错。
    const items = [
      contribution({ createdAt: "2026-04-01T02:00:00Z" }),
      contribution({ createdAt: "2026-04-30T22:00:00Z" }),
    ];

    vi.stubEnv("TZ", "Pacific/Midway"); // UTC-11 → 第一条会被推回 3 月
    const west = groupByMonth(items).map((b) => b.month);
    vi.stubEnv("TZ", "Pacific/Kiritimati"); // UTC+14 → 第二条会被推到 5 月
    const east = groupByMonth(items).map((b) => b.month);

    expect(west).toEqual(["2026-04"]);
    expect(east).toEqual(["2026-04"]);
  });
});

describe("概览数字", () => {
  it("三类分开数,并且如实报出被拒的那些", () => {
    const items = [
      contribution({ repository: "a/a", merged: true }),
      contribution({ repository: "a/a", merged: false, state: "open" }),
      contribution({ repository: "b/b", merged: false, state: "closed" }),
    ];
    expect(feedSummary(items)).toMatchObject({ total: 3, merged: 1, open: 1, closed: 1, repositories: 2 });
  });

  it("区间取最早和最晚", () => {
    const items = [
      contribution({ createdAt: "2026-09-13T00:00:00Z" }),
      contribution({ createdAt: "2026-03-23T00:00:00Z" }),
    ];
    expect(feedSummary(items)).toMatchObject({ from: "2026-03-23", to: "2026-09-13" });
  });

  it("空数据不炸,区间是 null", () => {
    expect(feedSummary([])).toMatchObject({ total: 0, repositories: 0, from: null, to: null });
  });
});

describe("只要别人仓库里的", () => {
  it("自己仓库的 PR 不进 feed", () => {
    const portfolio = {
      contributions: [
        contribution({ repository: "wellorbetter/own-thing", external: false }),
        contribution({ repository: "microsoft/mxc", external: true }),
      ],
    } as unknown as DeveloperPortfolio;
    expect(externalContributions(portfolio).map((i) => i.repository)).toEqual(["microsoft/mxc"]);
  });
});
