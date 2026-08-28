import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import { z } from "zod";
import { collectGitHubSnapshot } from "./github.js";
import { askJson, hasModel } from "./model.js";
import {
  CurationSchema,
  GitHubSnapshotSchema,
  IdentitySchema,
  SiteSpecSchema,
  type Curation,
  type GitHubSnapshot,
  type Identity,
  type SiteSpec,
} from "./types.js";

const AgentState = new StateSchema({
  username: z.string(),
  intent: z.string().default("Build a strong general-purpose personal developer website"),
  locale: z.enum(["en", "zh"]).default("en"),
  snapshot: GitHubSnapshotSchema.optional(),
  identity: IdentitySchema.optional(),
  curation: CurationSchema.optional(),
  spec: SiteSpecSchema.optional(),
  issues: z.array(z.string()).default(() => []),
  repairCount: z.number().int().nonnegative().default(0),
});

function compactSnapshot(snapshot: GitHubSnapshot): unknown {
  return {
    profile: snapshot.profile,
    stats: snapshot.stats,
    languages: snapshot.languages,
    projects: snapshot.projects.slice(0, 16),
    contributions: snapshot.contributions.slice(0, 30),
  };
}

function heuristicIdentity(snapshot: GitHubSnapshot, intent: string): Identity {
  const languages = snapshot.languages.slice(0, 4).map((item) => item.name);
  const external = snapshot.contributions.filter((item) => item.external);
  const themes = [
    ...languages,
    external.length ? "Open Source" : "Independent Projects",
    "Developer Tools",
  ].filter((value, index, array) => array.indexOf(value) === index).slice(0, 6);

  return {
    primaryRole: "Software Engineer & Builder",
    positioning: snapshot.profile.bio ?? `Builds practical software across ${languages.join(", ") || "multiple stacks"}.`,
    strengths: [
      snapshot.projects.length ? "Shipping public projects" : "Software engineering",
      external.length ? "Upstream open-source collaboration" : "Independent product development",
      languages.length ? `Cross-stack work: ${languages.join(", ")}` : "Generalist engineering",
    ],
    themes,
    audience: intent.toLowerCase().includes("job") || intent.toLowerCase().includes("recruit") ? "Hiring teams" : "Developers, collaborators, and hiring teams",
  };
}

function heuristicCuration(snapshot: GitHubSnapshot): Curation {
  const featuredProjects = snapshot.projects.slice(0, 6).map((item) => item.fullName);
  const featuredContributions = snapshot.contributions
    .filter((item) => item.external)
    .sort((a, b) => Number(b.merged) - Number(a.merged) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 8)
    .map((item) => `${item.repository}#${item.number}`);

  return {
    featuredProjects,
    featuredContributions,
    hiddenProjects: snapshot.projects.filter((item) => !featuredProjects.includes(item.fullName)).map((item) => item.fullName),
    rationale: [
      "Prefer source repositories over forks and archived work.",
      "Prefer projects with public adoption signals and recent activity.",
      "Prefer upstream contributions, with merged work first.",
    ],
  };
}

function pickVisual(identity: Identity): SiteSpec["visual"] {
  const text = `${identity.primaryRole} ${identity.positioning} ${identity.themes.join(" ")}`.toLowerCase();
  if (/systems|rust|cli|infra|terminal/.test(text)) return { mood: "technical", density: "balanced", accent: "violet", surface: "dark" };
  if (/design|creative|ui|frontend/.test(text)) return { mood: "editorial", density: "airy", accent: "coral", surface: "warm" };
  return { mood: "professional", density: "balanced", accent: "blue", surface: "paper" };
}

function heuristicSpec(snapshot: GitHubSnapshot, identity: Identity, curation: Curation): SiteSpec {
  const projects = curation.featuredProjects
    .map((fullName, index) => {
      const project = snapshot.projects.find((item) => item.fullName === fullName);
      if (!project) return null;
      return {
        fullName,
        title: project.name,
        summary: project.description ?? `${project.language ?? "Software"} project on GitHub.`,
        emphasis: index === 0 ? "hero" as const : index < 3 ? "featured" as const : "normal" as const,
        tags: [project.language, ...project.topics].filter((value): value is string => Boolean(value)).slice(0, 6),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const contributions = curation.featuredContributions
    .map((key) => {
      const item = snapshot.contributions.find((candidate) => `${candidate.repository}#${candidate.number}` === key);
      if (!item) return null;
      return {
        key,
        headline: item.title,
        summary: `${item.merged ? "Merged" : item.state === "open" ? "Open" : "Closed"} upstream contribution to ${item.repository}.`,
        whyItMatters: item.merged ? "Accepted by the upstream project and preserved as public engineering evidence." : "Shows active work in an external codebase.",
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const displayName = snapshot.profile.name ?? snapshot.profile.login;
  const mainTheme = identity.themes[0] ?? "software";
  return {
    version: 1,
    owner: snapshot.profile.login,
    identity: {
      displayName,
      eyebrow: `${identity.primaryRole} · ${snapshot.stats.externalMergedPullRequests} merged upstream PRs`,
      headline: `Building useful things around ${mainTheme}.`,
      summary: identity.positioning,
      role: identity.primaryRole,
    },
    navigation: [
      { label: "Work", target: "#projects" },
      { label: "Open Source", target: "#contributions" },
      { label: "About", target: "#about" },
    ],
    sections: [
      { id: "hero", type: "hero", title: displayName, visible: true },
      { id: "projects", type: "projects", title: "Selected Work", subtitle: "Projects worth seeing first.", visible: true },
      { id: "contributions", type: "contributions", title: "Open Source", subtitle: "Work in other people's codebases.", visible: contributions.length > 0 },
      { id: "activity", type: "activity", title: "GitHub Activity", visible: true },
      { id: "about", type: "about", title: "About", visible: true },
      { id: "contact", type: "contact", title: "Contact", visible: true },
    ],
    projects,
    contributions,
    visual: pickVisual(identity),
    meta: {
      rationale: [...curation.rationale, `Positioned for: ${identity.audience}.`],
      generatedBy: "personal-site-agent",
    },
  };
}

async function inferIdentity(snapshot: GitHubSnapshot, intent: string, locale: "en" | "zh"): Promise<Identity> {
  if (!hasModel()) return heuristicIdentity(snapshot, intent);
  try {
    return await askJson({
      schema: IdentitySchema,
      system: "You are a senior personal-brand editor for software engineers. Infer what this developer actually builds from public GitHub evidence. Do not invent employers, years of experience, impact, or skills not supported by the data. Return JSON only.",
      prompt: `Goal: ${intent}\nLanguage: ${locale}\nGitHub evidence:\n${JSON.stringify(compactSnapshot(snapshot))}\n\nReturn primaryRole, positioning, strengths, themes, audience. Prefer a specific truthful identity over generic 'full-stack developer'.`,
    });
  } catch {
    return heuristicIdentity(snapshot, intent);
  }
}

async function curate(snapshot: GitHubSnapshot, identity: Identity, intent: string): Promise<Curation> {
  if (!hasModel()) return heuristicCuration(snapshot);
  try {
    return await askJson({
      schema: CurationSchema,
      system: "You curate developer personal websites. Select evidence; do not create projects or PRs. IDs must exactly match supplied fullName or repository#number values. Favor representative work over raw volume. Return JSON only.",
      prompt: `Intent: ${intent}\nIdentity: ${JSON.stringify(identity)}\nEvidence: ${JSON.stringify(compactSnapshot(snapshot))}\n\nChoose up to 6 featuredProjects and 8 featuredContributions. Upstream merged contributions are high-value, but the site must still represent what the developer actually likes to build.`,
    });
  } catch {
    return heuristicCuration(snapshot);
  }
}

async function compose(snapshot: GitHubSnapshot, identity: Identity, curation: Curation, intent: string, locale: "en" | "zh"): Promise<SiteSpec> {
  if (!hasModel()) return heuristicSpec(snapshot, identity, curation);
  try {
    return await askJson({
      schema: SiteSpecSchema,
      system: "You are both an information architect and a strong web editor. Produce a SiteSpec for a developer personal website. You choose hierarchy, concise copy, and visual direction, but you may only reference supplied GitHub projects and contributions. Never fabricate metrics. Return JSON only.",
      prompt: `Intent: ${intent}\nLanguage: ${locale}\nIdentity: ${JSON.stringify(identity)}\nCuration: ${JSON.stringify(curation)}\nEvidence: ${JSON.stringify(compactSnapshot(snapshot))}\n\nBuild a distinctive personal site, not a generic SaaS landing page. Use generatedBy='personal-site-agent' and version=1.`,
    });
  } catch {
    return heuristicSpec(snapshot, identity, curation);
  }
}

export function validateSiteSpec(spec: SiteSpec, snapshot: GitHubSnapshot): string[] {
  const issues: string[] = [];
  const projectIds = new Set(snapshot.projects.map((item) => item.fullName));
  const contributionIds = new Set(snapshot.contributions.map((item) => `${item.repository}#${item.number}`));
  const sectionIds = new Set<string>();

  for (const project of spec.projects) {
    if (!projectIds.has(project.fullName)) issues.push(`Unknown project: ${project.fullName}`);
  }
  for (const contribution of spec.contributions) {
    if (!contributionIds.has(contribution.key)) issues.push(`Unknown contribution: ${contribution.key}`);
  }
  for (const section of spec.sections) {
    if (sectionIds.has(section.id)) issues.push(`Duplicate section id: ${section.id}`);
    sectionIds.add(section.id);
  }
  if (!spec.sections.some((item) => item.type === "hero" && item.visible)) issues.push("A visible hero section is required");
  if (!spec.sections.some((item) => item.type === "projects" && item.visible)) issues.push("A visible projects section is required");
  return issues;
}

function deterministicRepair(spec: SiteSpec, snapshot: GitHubSnapshot): SiteSpec {
  const projects = new Set(snapshot.projects.map((item) => item.fullName));
  const contributions = new Set(snapshot.contributions.map((item) => `${item.repository}#${item.number}`));
  const seen = new Set<string>();
  const sections = spec.sections.filter((section) => {
    if (seen.has(section.id)) return false;
    seen.add(section.id);
    return true;
  });
  if (!sections.some((item) => item.type === "hero" && item.visible)) sections.unshift({ id: "hero", type: "hero", title: spec.identity.displayName, visible: true });
  if (!sections.some((item) => item.type === "projects" && item.visible)) sections.push({ id: "projects", type: "projects", title: "Selected Work", visible: true });
  return {
    ...spec,
    sections,
    projects: spec.projects.filter((item) => projects.has(item.fullName)),
    contributions: spec.contributions.filter((item) => contributions.has(item.key)),
  };
}

const collectNode: typeof AgentState.Node = async (state) => ({
  snapshot: await collectGitHubSnapshot(state.username),
});

const identityNode: typeof AgentState.Node = async (state) => {
  if (!state.snapshot) throw new Error("snapshot missing");
  return { identity: await inferIdentity(state.snapshot, state.intent, state.locale) };
};

const curationNode: typeof AgentState.Node = async (state) => {
  if (!state.snapshot || !state.identity) throw new Error("snapshot/identity missing");
  return { curation: await curate(state.snapshot, state.identity, state.intent) };
};

const composeNode: typeof AgentState.Node = async (state) => {
  if (!state.snapshot || !state.identity || !state.curation) throw new Error("generation inputs missing");
  return { spec: await compose(state.snapshot, state.identity, state.curation, state.intent, state.locale) };
};

const validateNode: typeof AgentState.Node = (state) => {
  if (!state.snapshot || !state.spec) throw new Error("validation inputs missing");
  return { issues: validateSiteSpec(state.spec, state.snapshot) };
};

const repairNode: typeof AgentState.Node = async (state) => {
  if (!state.snapshot || !state.spec) throw new Error("repair inputs missing");
  if (!hasModel()) return { spec: deterministicRepair(state.spec, state.snapshot), repairCount: state.repairCount + 1 };
  try {
    const repaired = await askJson({
      schema: SiteSpecSchema,
      system: "Repair a SiteSpec without adding unsupported facts. Preserve good editorial decisions. Return JSON only.",
      prompt: `Validation issues: ${JSON.stringify(state.issues)}\nEvidence IDs: ${JSON.stringify({ projects: state.snapshot.projects.map((item) => item.fullName), contributions: state.snapshot.contributions.map((item) => `${item.repository}#${item.number}`) })}\nCurrent SiteSpec: ${JSON.stringify(state.spec)}`,
      temperature: 0,
    });
    return { spec: repaired, repairCount: state.repairCount + 1 };
  } catch {
    return { spec: deterministicRepair(state.spec, state.snapshot), repairCount: state.repairCount + 1 };
  }
};

function afterValidation(state: typeof AgentState.State): "repair" | typeof END {
  return state.issues.length > 0 && state.repairCount < 2 ? "repair" : END;
}

export const personalSiteAgent = new StateGraph(AgentState)
  .addNode("collect", collectNode)
  .addNode("understand", identityNode)
  .addNode("curate", curationNode)
  .addNode("compose", composeNode)
  .addNode("validate", validateNode)
  .addNode("repair", repairNode)
  .addEdge(START, "collect")
  .addEdge("collect", "understand")
  .addEdge("understand", "curate")
  .addEdge("curate", "compose")
  .addEdge("compose", "validate")
  .addConditionalEdges("validate", afterValidation)
  .addEdge("repair", "validate")
  .compile();

export type PersonalSiteAgentInput = {
  username: string;
  intent?: string;
  locale?: "en" | "zh";
};

export async function generatePersonalSite(input: PersonalSiteAgentInput): Promise<SiteSpec> {
  const result = await personalSiteAgent.invoke({
    username: input.username,
    intent: input.intent ?? "Build a strong general-purpose personal developer website",
    locale: input.locale ?? "en",
    issues: [],
    repairCount: 0,
  });
  if (!result.spec) throw new Error("Agent completed without a SiteSpec");
  const issues = result.snapshot ? validateSiteSpec(result.spec, result.snapshot) : ["snapshot missing"];
  if (issues.length) throw new Error(`Agent produced an invalid SiteSpec: ${issues.join("; ")}`);
  return result.spec;
}
