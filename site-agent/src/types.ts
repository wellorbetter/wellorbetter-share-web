import { z } from "zod";

export const GitHubProjectSchema = z.object({
  name: z.string(),
  fullName: z.string(),
  url: z.string().url(),
  description: z.string().nullable(),
  homepage: z.string().nullable(),
  language: z.string().nullable(),
  topics: z.array(z.string()),
  stars: z.number().int().nonnegative(),
  forks: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

export const GitHubContributionSchema = z.object({
  repository: z.string(),
  number: z.number().int().positive(),
  title: z.string(),
  url: z.string().url(),
  state: z.enum(["open", "closed"]),
  merged: z.boolean(),
  external: z.boolean(),
  updatedAt: z.string(),
});

export const GitHubSnapshotSchema = z.object({
  profile: z.object({
    login: z.string(),
    name: z.string().nullable(),
    avatarUrl: z.string().url(),
    githubUrl: z.string().url(),
    bio: z.string().nullable(),
    company: z.string().nullable(),
    location: z.string().nullable(),
    website: z.string().nullable(),
  }),
  stats: z.object({
    publicRepos: z.number().int().nonnegative(),
    followers: z.number().int().nonnegative(),
    stars: z.number().int().nonnegative(),
    pullRequests: z.number().int().nonnegative(),
    externalPullRequests: z.number().int().nonnegative(),
    externalMergedPullRequests: z.number().int().nonnegative(),
  }),
  languages: z.array(z.object({ name: z.string(), repos: z.number().int().positive() })),
  projects: z.array(GitHubProjectSchema),
  contributions: z.array(GitHubContributionSchema),
});

export type GitHubSnapshot = z.infer<typeof GitHubSnapshotSchema>;

export const IdentitySchema = z.object({
  primaryRole: z.string().min(2),
  positioning: z.string().min(8),
  strengths: z.array(z.string()).min(2).max(8),
  themes: z.array(z.string()).min(1).max(8),
  audience: z.string().min(2),
});

export type Identity = z.infer<typeof IdentitySchema>;

export const CurationSchema = z.object({
  featuredProjects: z.array(z.string()).max(6),
  featuredContributions: z.array(z.string()).max(8),
  hiddenProjects: z.array(z.string()).max(40),
  rationale: z.array(z.string()).max(12),
});

export type Curation = z.infer<typeof CurationSchema>;

const SectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["hero", "projects", "contributions", "activity", "about", "contact"]),
  title: z.string(),
  subtitle: z.string().optional(),
  visible: z.boolean().default(true),
});

export const SiteSpecSchema = z.object({
  version: z.literal(1),
  owner: z.string(),
  identity: z.object({
    displayName: z.string(),
    eyebrow: z.string(),
    headline: z.string(),
    summary: z.string(),
    role: z.string(),
  }),
  navigation: z.array(z.object({ label: z.string(), target: z.string() })).max(8),
  sections: z.array(SectionSchema).min(3).max(8),
  projects: z.array(z.object({
    fullName: z.string(),
    title: z.string(),
    summary: z.string(),
    emphasis: z.enum(["hero", "featured", "normal"]),
    tags: z.array(z.string()).max(6),
  })).max(8),
  contributions: z.array(z.object({
    key: z.string(),
    headline: z.string(),
    summary: z.string(),
    whyItMatters: z.string(),
  })).max(10),
  visual: z.object({
    mood: z.enum(["editorial", "technical", "minimal", "playful", "professional"]),
    density: z.enum(["airy", "balanced", "dense"]),
    accent: z.enum(["violet", "blue", "lime", "coral", "amber", "mono"]),
    surface: z.enum(["warm", "cool", "dark", "paper"]),
  }),
  meta: z.object({
    rationale: z.array(z.string()).max(12),
    generatedBy: z.literal("personal-site-agent"),
  }),
});

export type SiteSpec = z.infer<typeof SiteSpecSchema>;
