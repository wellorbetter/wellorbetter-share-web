export type PortfolioProject = {
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  license: string | null;
  updatedAt: string;
};

export type PortfolioContribution = {
  repository: string;
  repositoryOwner: string;
  number: number;
  title: string;
  url: string;
  state: "open" | "closed";
  merged: boolean;
  external: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioActivity = {
  period: { from: string; to: string };
  years: number[];
  totalContributions: number;
  restrictedContributions: number;
  commits: number;
  issues: number;
  pullRequests: number;
  reviews: number;
  repositories: {
    commits: number;
    issues: number;
    pullRequests: number;
    reviews: number;
  };
  calendar: Array<{
    date: string;
    count: number;
    level: string;
  }>;
  topCommitRepositories: Array<{
    repository: string;
    url: string;
    commits: number;
  }>;
};

export type DeveloperPortfolio = {
  version: 2;
  profile: {
    login: string;
    name: string | null;
    avatarUrl: string;
    githubUrl: string;
    bio: string | null;
    company: string | null;
    location: string | null;
    website: string | null;
    joinedAt: string;
  };
  stats: {
    publicRepos: number;
    sourceRepos: number;
    stars: number;
    followers: number;
    pullRequests: number;
    mergedPullRequests: number;
    externalPullRequests: number;
    externalMergedPullRequests: number;
  };
  languages: Array<{ name: string; repos: number }>;
  projects: PortfolioProject[];
  contributions: PortfolioContribution[];
  activity: PortfolioActivity | null;
  generatedAt: string;
};

type ApiError = { error?: { code?: string; message?: string } };

// Production defaults to the landing Worker's same-origin BFF. VITE_API_BASE remains
// available for local integration or a future centralized API deployment.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

export function portfolioPath(username: string): string {
  return `/u/${encodeURIComponent(username)}`;
}

export async function fetchPortfolio(username: string, signal?: AbortSignal): Promise<DeveloperPortfolio> {
  const response = await fetch(`${API_BASE}/api/portfolio/${encodeURIComponent(username)}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as ApiError;
      if (body.error?.message) message = body.error.message;
    } catch {
      // Keep the status-based fallback.
    }
    throw new Error(message);
  }
  const body = (await response.json()) as DeveloperPortfolio;
  if (body.version !== 2) throw new Error("Portfolio API version mismatch");
  return body;
}
