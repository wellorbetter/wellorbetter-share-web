import type { SiteSpec } from "./site-spec.js";

export type SitePresentation = "focus" | "flow" | "auto";
export type PresentableSiteSpec = SiteSpec & { presentation?: SitePresentation };

export function presentationOf(spec: SiteSpec): SitePresentation {
  const value = (spec as PresentableSiteSpec).presentation;
  return value === "focus" || value === "flow" || value === "auto" ? value : "auto";
}

export function resolvedPresentation(spec: SiteSpec): Exclude<SitePresentation, "auto"> {
  const value = presentationOf(spec);
  if (value !== "auto") return value;
  return spec.projects.length <= 5 ? "focus" : "flow";
}

export function withPresentation(spec: SiteSpec, presentation: SitePresentation): SiteSpec {
  return { ...spec, presentation } as PresentableSiteSpec;
}

export function presentationInstruction(instruction: string): SitePresentation | null {
  const text = instruction.toLowerCase();
  if (/focus|one screen|one-screen|full screen|fullscreen|一屏|一页一个|每屏|沉浸|翻页/.test(text)) return "focus";
  if (/flow|continuous|scroll|feed|连续|滚动|上下|渐进|瀑布/.test(text)) return "flow";
  if (/auto|automatic|自动/.test(text) && /(presentation|layout|展示|模式)/.test(text)) return "auto";
  return null;
}
