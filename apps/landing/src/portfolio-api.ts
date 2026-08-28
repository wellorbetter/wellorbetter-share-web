import type { DeveloperPortfolio, PortfolioActivity, PortfolioContribution, PortfolioProject } from "./portfolio.js";

const GITHUB_API = "https://api.github.com";
const GITHUB_GRAPHQL = "https://api.github.com/graphql";
const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

type PortfolioEnv = {
  GITHUB_TOKEN?: string;
};

type GitHubUser = {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string;
  public_repos: number;
  followers: number;
  created_at: string;
};

type GitHubRepo = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics?: string[];
  homepage: string | null;
  updated_at: string;
  pushed_at: string;
  open_issues_count: number;
  license: { spdx_id?: string | null } | null;
};

type GitHubPull = {
  number: number;
  title: string;
  html_url: string;
  repository_url: string;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
  pull_request?: { merged_at?: string | null };
};

type SearchResponse<T> = { total_count: number; items: T[] };

type GraphqlActivity = {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionYears: number[];
        startedAt: string;
        endedAt: string;
        restrictedContributionsCount: number;
        totalCommitContributions: number;
        totalIssueContributions: number;
        totalPullRequestContributions: number;
        totalPullRequestReviewContributions: number;
        totalRepositoriesWithContributedCommits: number;
        totalRepositoriesWithContributedIssues: number;
        totalRepositoriesWithContributedPullRequests: number;
        totalRepositoriesWithContributedPullRequestReviews: number;
        contributionCalendar: {
          totalContributions: number;
          weeks: Array<{
            contributionDays: Array<{ date: string; contributionCount: number; contributionLevel: string }>;
          }>;
        };
        commitContributionsByRepository: Array<{
          repository: { nameWithOwner: string; url: string };
          contributions: { totalCount: number };
        }>;
      };
    } | null;
  };
  errors?: unknown[];
};

const CONTRIBUTION_QUERY = `
query PortfolioActivity($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionYears
      startedAt
      endedAt
      restrictedContributionsCount
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalRepositoriesWithContributedCommits
      totalRepositoriesWithContributedIssues
      totalRepositoriesWithContributedPullRequests
      totalRepositoriesWithContributedPullRequestReviews
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
      commitContributionsByRepository(maxRepositories: 12) {
        repository { nameWithOwner url }
        contributions { totalCount }
      }
    }
  }
}`;

function headers(env: PortfolioEnv): Headers {
  const value = new Headers({
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "wellorbetter-portfolio/2.0",
  });
  if (env.GITHUB_TOKEN) value.set("Authorization", `Bearer ${env.GITHUB_TOKEN}`);
  return value;
}

async function githubJson<T>(env: PortfolioEnv, url: string): Promise<{ status: number; data: T | null }> {
  const response = await fetch(url, { headers: headers(env) });
  if (!response.ok) return { status: response.status, data: null };
  return { status: response.status, data: (await response.json()) as T };
}

async function activity(env: PortfolioEnv, username: string): Promise<PortfolioActivity | null> {
  if (!env.GITHUB_TOKEN) return null;
  try {
    const response = await fetch(GITHUB_GRAPHQL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "wellorbetter-portfolio/2.0",
      },
      body: JSON.stringify({ query: CONTRIBUTION_QUERY, variables: { login: username } }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as GraphqlActivity;
    if (payload.errors?.length) return null;
    const collection = payload.data?.user?.contributionsCollection;
    if (!collection) return null;
    return {
      period: { from: collection.startedAt, to: collection.endedAt },
      years: collection.contributionYears,
      totalContributions: collection.contributionCalendar.totalContributions,
      restrictedContributions: collection.restrictedContributionsCount,
      commits: collection.totalCommitContributions,
      issues: collection.totalIssueContributions,
      pullRequests: collection.totalPullRequestContributions,
      reviews: collection.totalPullRequestReviewContributions,
      repositories: {
        commits: collection.totalRepositoriesWithContributedCommits,
        issues: collection.totalRepositoriesWithContributedIssues,
        pullRequests: collection.totalRepositoriesWithContributedPullRequests,
        reviews: collection.totalRepositoriesWithContributedPullRequestReviews,
      },
      calendar: collection.contributionCalendar.weeks.flatMap((week) =>
        week.contributionDays.map((day) => ({ date: day.date, count: day.contributionCount, level: day.contributionLevel })),
      ),
      topCommitRepositories: collection.commitContributionsByRepository
        .map((item) => ({ repository: item.repository.nameWithOwner, url: item.repository.url, commits: item.contributions.totalCount }))
        .sort((a, b) => b.commits - a.commits),
    };
  } catch {
    return null;
  }
}

function repoFromApi(value: string): string {
  try {
    const pathname = new URL(value).pathname;
    const marker = "/repos/";
    const index = pathname.indexOf(marker);
    return index < 0 ? "unknown/unknown" : pathname.slice(index + marker.length);
  } catch {
    return "unknown/unknown";
  }
}

function website(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function projects(repos: GitHubRepo[]): PortfolioProject[] {
  return repos
    .filter((repo) => !repo.fork && !repo.archived)
    .sort((a, b) => b.stargazers_count - a.stargazers_count || Date.parse(b.pushed_at) - Date.parse(a.pushed_at))
    .slice(0, 16)
    .map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      description: repo.description,
      homepage: repo.homepage || null,
      language: repo.language,
      topics: repo.topics ?? [],
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      license: repo.license?.spdx_id ?? null,
      updatedAt: repo.updated_at,
    }));
}

function languages(repos: GitHubRepo[]): Array<{ name: string; repos: number }> {
  const counts = new Map<string, number>();
  for (const repo of repos) {
    if (repo.fork || repo.archived || !repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, repos: count }))
    .sort((a, b) => b.repos - a.repos || a.name.localeCompare(b.name))
    .slice(0, 10);
}

function contributions(username: string, items: GitHubPull[]): PortfolioContribution[] {
  const owner = username.toLowerCase();
  return items
    .map((item) => {
      const repository = repoFromApi(item.repository_url);
      const repositoryOwner = repository.split("/")[0] ?? "unknown";
      return {
        repository,
        repositoryOwner,
        number: item.number,
        title: item.title,
        url: item.html_url,
        state: item.state,
        merged: Boolean(item.pull_request?.merged_at),
        external: repositoryOwner.toLowerCase() !== owner,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      } satisfies PortfolioContribution;
    })
    .sort((a, b) => Number(b.external) - Number(a.external) || Number(b.merged) - Number(a.merged) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 60);
}

async function build(env: PortfolioEnv, username: string): Promise<{ status: number; portfolio: DeveloperPortfolio | null }> {
  const encoded = encodeURIComponent(username);
  const search = new URL(`${GITHUB_API}/search/issues`);
  search.searchParams.set("q", `author:${username} type:pr`);
  search.searchParams.set("per_page", "100");
  search.searchParams.set("sort", "updated");
  search.searchParams.set("order", "desc");

  const [userResult, repoResult, pullResult, contributionActivity] = await Promise.all([
    githubJson<GitHubUser>(env, `${GITHUB_API}/users/${encoded}`),
    githubJson<GitHubRepo[]>(env, `${GITHUB_API}/users/${encoded}/repos?per_page=100&sort=updated&type=owner`),
    githubJson<SearchResponse<GitHubPull>>(env, search.toString()),
    activity(env, username),
  ]);

  if (userResult.status === 404) return { status: 404, portfolio: null };
  if (!userResult.data) return { status: userResult.status || 502, portfolio: null };

  const user = userResult.data;
  const repos = repoResult.data ?? [];
  const pullSearch = pullResult.data ?? { total_count: 0, items: [] };
  const normalized = contributions(user.login, pullSearch.items);
  const source = repos.filter((repo) => !repo.fork && !repo.archived);

  return {
    status: 200,
    portfolio: {
      version: 2,
      profile: {
        login: user.login,
        name: user.name,
        avatarUrl: user.avatar_url,
        githubUrl: user.html_url,
        bio: user.bio,
        company: user.company,
        location: user.location,
        website: website(user.blog),
        joinedAt: user.created_at,
      },
      stats: {
        publicRepos: user.public_repos,
        sourceRepos: source.length,
        stars: source.reduce((sum, repo) => sum + repo.stargazers_count, 0),
        followers: user.followers,
        pullRequests: pullSearch.total_count,
        mergedPullRequests: normalized.filter((item) => item.merged).length,
        externalPullRequests: normalized.filter((item) => item.external).length,
        externalMergedPullRequests: normalized.filter((item) => item.external && item.merged).length,
      },
      languages: languages(repos),
      projects: projects(repos),
      contributions: normalized,
      activity: contributionActivity,
      generatedAt: new Date().toISOString(),
    },
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": status === 200 ? "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600" : "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function portfolioApi(request: Request, env: PortfolioEnv, username: string): Promise<Response> {
  if (!USERNAME_RE.test(username)) return jsonResponse({ error: { code: "invalid_username", message: "Invalid GitHub username" } }, 400);

  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(request.url, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const result = await build(env, username);
    if (!result.portfolio) {
      if (result.status === 404) return jsonResponse({ error: { code: "github_user_not_found", message: "GitHub user not found" } }, 404);
      return jsonResponse({ error: { code: "github_unavailable", message: "GitHub data is temporarily unavailable" } }, 502);
    }
    const response = jsonResponse(result.portfolio);
    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    console.error("portfolio_bff_failed", { username, error: String(error) });
    return jsonResponse({ error: { code: "github_unavailable", message: "GitHub data is temporarily unavailable" } }, 502);
  }
}
