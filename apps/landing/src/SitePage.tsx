import { useEffect, useMemo, useState } from "react";
import { decodeSiteSpec, fetchSite, studioPath } from "./site-client.js";
import type { SiteGeneration, SiteLocale, SiteSpec } from "./site-spec.js";
import { isSiteSpec, repairSiteSpec, validateSiteSpec } from "./site-spec.js";
import SiteRenderer from "./SiteRenderer.js";

const loadingCopy = {
  en: ["Reading public GitHub", "Understanding the work", "Curating projects", "Writing the page", "Choosing visual direction"],
  zh: ["读取公开 GitHub", "理解这个开发者", "筛选代表项目", "组织页面文案", "选择视觉方向"],
} as const;

export default function SitePage({ username }: { username: string }) {
  const [locale, setLocale] = useState<SiteLocale>(() => localStorage.getItem("psa_locale") === "zh" || (!localStorage.getItem("psa_locale") && navigator.language.toLowerCase().startsWith("zh")) ? "zh" : "en");
  const [generation, setGeneration] = useState<SiteGeneration | null>(null);
  const [draft, setDraft] = useState<SiteSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    localStorage.setItem("psa_locale", locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    setGeneration(null); setDraft(null); setError(null); setStep(0);
    timer = window.setInterval(() => setStep((value) => Math.min(value + 1, loadingCopy[locale].length - 1)), 650);
    fetchSite(username, "", locale, controller.signal)
      .then((result) => {
        setGeneration(result);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const encoded = hash.get("draft");
        if (encoded) {
          const candidate = decodeSiteSpec(encoded);
          if (candidate && isSiteSpec(candidate)) {
            const repaired = repairSiteSpec(candidate, result.portfolio);
            if (!validateSiteSpec(repaired, result.portfolio).length) setDraft(repaired);
          }
        }
        document.title = `${result.spec.identity.displayName} — ${result.spec.identity.role}`;
        const meta = document.querySelector('meta[name="description"]') ?? document.head.appendChild(document.createElement("meta"));
        meta.setAttribute("name", "description");
        meta.setAttribute("content", result.spec.identity.summary);
      })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (timer) window.clearInterval(timer); });
    return () => { controller.abort(); if (timer) window.clearInterval(timer); };
  }, [locale, reload, username]);

  const spec = useMemo(() => draft ?? generation?.spec ?? null, [draft, generation]);

  if (!generation && !error) return <div className="site-loading-screen"><a className="site-product-mark" href="/">PERSONAL SITE AGENT <i>β</i></a><div className="site-loading-core"><span className="site-loading-orbit" /><p>@{username}</p><h1>{loadingCopy[locale][step]}</h1><div>{loadingCopy[locale].map((label, index) => <span className={index <= step ? "is-done" : ""} key={label}>{index < step ? "✓" : index === step ? "●" : "○"} {label}</span>)}</div></div></div>;

  if (error || !generation || !spec) return <div className="site-error-screen"><a className="site-product-mark" href="/">PERSONAL SITE AGENT <i>β</i></a><h1>{locale === "zh" ? "这个主页暂时生成失败" : "This site could not be generated"}</h1><p>{error ?? "Unknown error"}</p><div><button type="button" onClick={() => setReload((value) => value + 1)}>{locale === "zh" ? "重试" : "Retry"}</button><a href="/">{locale === "zh" ? "返回首页" : "Back home"}</a></div></div>;

  return <div className="site-public-wrap"><div className="site-public-tools"><a href="/" className="site-product-mark">PERSONAL SITE AGENT <i>β</i></a><div>{draft ? <span className="site-draft-badge">{locale === "zh" ? "分享草稿" : "Shared draft"}</span> : null}<button type="button" onClick={() => setLocale((value) => value === "zh" ? "en" : "zh")}>{locale === "zh" ? "EN" : "中"}</button><a className="site-customize-btn" href={studioPath(username)}>{locale === "zh" ? "用 Agent 修改" : "Customize with Agent"} ↗</a></div></div><SiteRenderer generation={generation} spec={spec} /></div>;
}
