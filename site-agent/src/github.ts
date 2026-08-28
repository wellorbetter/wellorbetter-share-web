import type { GitHubSnapshot } from "./types.js";

const GITHUB_API = "https://api.github.com";

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
};

type GitHubRepo = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  archived: boolean;
  pushed_at: string;
  updated_at: string;
};

type GitHubPullItem = {
  number: number;
  title: string;
  html_url: string;
  repository_url: string;
  state: "open" | "closed";
  updated_at: string;
  pull_request?: { merged_at?: string | null };
};

type GitHubSearch<T> = {
  total_count: number;
  items: T[];
};

function headers(): Headers {
  const result = new Headers({
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "personal-site-agent/0.1",
  });
  const token = process.env.GITHUB_TOKEN;
  if (token) result.set("Authorization", `Bearer ${token}`);
  return result;
}

async function githubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) {
    throw new Error(`GitHub ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

function repositoryFromApiUrl(url: string): string {
  const marker = "/repos/";
  const index = url.indexOf(marker);
  return index >= 0 ? url.slice(index + marker.length) : "unknown/unknown";
}

export async function collectGitHubSnapshot(username: string): Promise<GitHubSnapshot> {
  const encoded = encodeURIComponent(username);
  const search = new URL(`${GITHUB_API}/search/issues`);
  search.searchParams.set("q", `author:${username} type:pr`);
  search.searchParams.set("per_page", "100");
  search.searchParams.set("sort", "updated");
  search.searchParams.set("order", "desc");

  const [user, repos, pulls] = await Promise.all([
    githubJson<GitHubUser>(`${GITHUB_API}/users/${encoded}`),
    githubJson<GitHubRepo[]>(`${GITHUB_API}/users/${encoded}/repos?per_page=100&type=owner&sort=updated`),
    githubJson<GitHubSearch<GitHubPullItem>>(search.toString()),
  ]);

  const sourceRepos = repos.filter((repo) => !repo.fork && !repo.archived);
  const languages = new Map<string, number>();
  for (const repo of sourceRepos) {
    if (repo.language) languages.set(repo.language, (languages.get(repo.language) ?? 0) + 1);
  }

  const contributions = pulls.items.map((item) => {
    const repository = repositoryFromApiUrl(item.repository_url);
    const owner = repository.split("/")[0]?.toLowerCase() ?? "unknown";
    return {
      repository,
      number: item.number,
      title: item.title,
      url: item.html_url,
      state: item.state,
      merged: Boolean(item.pull_request?.merged_at),
      external: owner !== user.login.toLowerCase(),
      updatedAt: item.updated_at,
    };
  }).sort((a, b) => {
    if (a.external !== b.external) return a.external ? -1 : 1;
    if (a.merged !== b.merged) return a.merged ? -1 : 1;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });

  return {
    profile: {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      githubUrl: user.html_url,
      bio: user.bio,
      company: user.company,
      location: user.location,
      website: user.blog.trim() || null,
    },
    stats: {
      publicRepos: user.public_repos,
      followers: user.followers,
      stars: sourceRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0),
      pullRequests: pulls.total_count,
      externalPullRequests: contributions.filter((item) => item.external).length,
      externalMergedPullRequests: contributions.filter((item) => item.external && item.merged).length,
    },
    languages: [...languages.entries()]
      .map(([name, count]) => ({ name, repos: count }))
      .sort((a, b) => b.repos - a.repos || a.name.localeCompare(b.name))
      .slice(0, 10),
    projects: sourceRepos
      .sort((a, b) => b.stargazers_count - a.stargazers_count || Date.parse(b.pushed_at) - Date.parse(a.pushed_at))
      .slice(0, 24)
      .map((repo) => ({
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        description: repo.description,
        homepage: repo.homepage,
        language: repo.language,
        topics: repo.topics ?? [],
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        updatedAt: repo.updated_at,
      })),
    contributions: contributions.slice(0, 100),
  };
}
