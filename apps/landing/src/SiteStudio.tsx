import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { applyDeterministicEdit, isSiteSpec, repairSiteSpec, validateSiteSpec } from "./site-spec.js";
import type { SiteGeneration, SiteLocale, SiteSpec } from "./site-spec.js";
import { draftShareUrl, editSite, generateSite, sitePath } from "./site-client.js";
import { presentationInstruction, presentationOf, withPresentation } from "./presentation.js";
import type { SitePresentation } from "./presentation.js";
import SiteRenderer from "./SiteRenderer.js";

type Message = { role: "agent" | "user"; text: string };

const quickActions = {
  en: ["Use Focus mode", "Use Flow mode", "Make it more minimal", "Focus on open source", "Focus on AI / agent work"],
  zh: ["每屏只展示一个信息", "改成连续滚动浏览", "更极简一点", "重点展示开源贡献", "重点展示 AI / Agent 项目"],
} as const;

const presentationOptions: Array<{ id: SitePresentation; title: string; en: string; zh: string }> = [
  { id: "focus", title: "Focus", en: "One screen, one idea. Projects become full-screen chapters.", zh: "一屏一个信息。项目像章节一样逐页浏览。" },
  { id: "flow", title: "Flow", en: "Continuous reading for faster scanning and more projects.", zh: "连续浏览，适合快速扫完更多项目。" },
  { id: "auto", title: "Auto", en: "Focus for smaller portfolios, Flow when there is more to scan.", zh: "项目少时 Focus，内容多时自动切换 Flow。" },
];

function downloadSpec(username: string, spec: SiteSpec) {
  const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${username}-site-spec.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SiteStudio({ username }: { username: string }) {
  const initialIntent = new URLSearchParams(window.location.search).get("intent") ?? "";
  const [locale, setLocale] = useState<SiteLocale>(() => localStorage.getItem("psa_locale") === "zh" || (!localStorage.getItem("psa_locale") && navigator.language.toLowerCase().startsWith("zh")) ? "zh" : "en");
  const [generation, setGeneration] = useState<SiteGeneration | null>(null);
  const [spec, setSpec] = useState<SiteSpec | null>(null);
  const [history, setHistory] = useState<SiteSpec[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [instruction, setInstruction] = useState("");
  const [intent, setIntent] = useState(initialIntent);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const storageKey = `psa:draft:${username.toLowerCase()}`;

  useEffect(() => { localStorage.setItem("psa_locale", locale); }, [locale]);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError(null);
    generateSite(username, initialIntent, locale, controller.signal)
      .then((result) => {
        setGeneration(result);
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          try {
            const saved = JSON.parse(stored) as unknown;
            if (isSiteSpec(saved) && saved.owner.toLowerCase() === result.portfolio.profile.login.toLowerCase()) {
              const repaired = repairSiteSpec(saved, result.portfolio);
              if (!validateSiteSpec(repaired, result.portfolio).length) {
                setSpec(repaired);
                setMessages([{ role: "agent", text: locale === "zh" ? "我恢复了你上次保存在这台设备上的草稿。展示方式也会一起保留。" : "I restored the draft saved on this device, including its presentation mode." }]);
                return;
              }
            }
          } catch { localStorage.removeItem(storageKey); }
        }
        setSpec(result.spec);
        setMessages([{ role: "agent", text: result.agent.mode === "ai" ? (locale === "zh" ? "我读完 GitHub 了，已经先帮你做了一版。你可以直接用自然语言让我改。" : "I read the GitHub profile and built a first version. Tell me what to change in plain language.") : (locale === "zh" ? "基础版本已经生成。你可以直接改展示模式或继续用自然语言编辑。" : "The baseline is ready. Change the presentation mode directly or keep editing in plain language.") }]);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setBusy(false));
    return () => controller.abort();
  }, [initialIntent, locale, storageKey, username]);

  useEffect(() => { if (spec) localStorage.setItem(storageKey, JSON.stringify(spec)); }, [spec, storageKey]);

  const mode = generation?.agent.mode ?? "deterministic";
  const shareUrl = useMemo(() => spec ? draftShareUrl(username, spec) : "", [spec, username]);
  const presentation = spec ? presentationOf(spec) : "auto";

  function apply(next: SiteSpec, userText: string, agentText: string) {
    if (spec) setHistory((items) => [...items.slice(-19), spec]);
    setSpec(next);
    setMessages((items) => [...items, { role: "user", text: userText }, { role: "agent", text: agentText }]);
  }

  function choosePresentation(value: SitePresentation) {
    if (!spec) return;
    apply(withPresentation(spec, value), `Presentation: ${value}`, locale === "zh" ? `展示方式已切换为 ${value === "focus" ? "Focus（一屏一个信息）" : value === "flow" ? "Flow（连续浏览）" : "Auto（自动选择）"}。` : `Presentation changed to ${value}.`);
  }

  async function send(text = instruction) {
    const value = text.trim();
    if (!value || !spec || !generation || busy) return;
    const requestedPresentation = presentationInstruction(value);
    if (requestedPresentation) {
      setInstruction("");
      choosePresentation(requestedPresentation);
      window.setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    setInstruction(""); setBusy(true); setNotice(null);
    try {
      const result = await editSite(username, spec, value, locale);
      apply(result.spec, value, result.changes.join(" "));
    } catch {
      const fallback = applyDeterministicEdit(spec, generation.portfolio, value, locale);
      apply(fallback.spec, value, fallback.changes.join(" "));
    } finally {
      setBusy(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(); }

  async function regenerate() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const result = await generateSite(username, intent.trim(), locale);
      const currentPresentation = spec ? presentationOf(spec) : "auto";
      if (spec) setHistory((items) => [...items.slice(-19), spec]);
      setGeneration(result); setSpec(withPresentation(result.spec, currentPresentation));
      setMessages((items) => [...items, { role: "agent", text: locale === "zh" ? `我按新的目标重新生成了页面，并保留了 ${currentPresentation} 展示方式。` : `I regenerated the site and kept the ${currentPresentation} presentation.` }]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }

  function undo() { const previous = history.at(-1); if (!previous) return; setHistory((items) => items.slice(0, -1)); setSpec(previous); setNotice(locale === "zh" ? "已撤销上一次修改" : "Undid the last change"); }
  async function copyShare() { if (!shareUrl) return; try { await navigator.clipboard.writeText(shareUrl); setNotice(locale === "zh" ? "草稿分享链接已复制" : "Draft share link copied"); } catch { window.prompt(locale === "zh" ? "复制这个链接" : "Copy this link", shareUrl); } }
  function resetDraft() { if (!generation) return; if (spec) setHistory((items) => [...items.slice(-19), spec]); localStorage.removeItem(storageKey); setSpec(generation.spec); setMessages((items) => [...items, { role: "agent", text: locale === "zh" ? "已恢复 Agent 最初生成的版本。" : "Restored the agent's original version." }]); }

  if (busy && !generation) return <div className="studio-loading"><span>PERSONAL SITE AGENT</span><h1>{locale === "zh" ? "正在读 GitHub 并生成第一版…" : "Reading GitHub and building the first version…"}</h1><i /></div>;
  if (error || !generation || !spec) return <div className="studio-error"><span>PERSONAL SITE AGENT</span><h1>{locale === "zh" ? "Studio 暂时打不开" : "The studio could not start"}</h1><p>{error ?? "Unknown error"}</p><a href="/">← {locale === "zh" ? "返回首页" : "Back home"}</a></div>;

  return <div className="site-studio"><header className="studio-topbar"><a href="/" className="studio-logo">PERSONAL SITE AGENT <i>β</i></a><div className="studio-context"><span>@{username}</span><b>{mode === "ai" ? `AI · ${generation.agent.model ?? "model"}` : "LOCAL RULES · AI READY"}</b></div><div className="studio-actions"><button type="button" disabled={!history.length} onClick={undo}>↶ {locale === "zh" ? "撤销" : "Undo"}</button><button type="button" onClick={() => downloadSpec(username, spec)}>{locale === "zh" ? "导出 JSON" : "Export JSON"}</button><button type="button" onClick={() => void copyShare()}>{locale === "zh" ? "分享草稿" : "Share draft"}</button><a href={sitePath(username)} target="_blank" rel="noreferrer">{locale === "zh" ? "公开页" : "Public page"} ↗</a></div></header><div className="studio-layout"><main className="studio-preview-pane"><div className="studio-preview-toolbar"><span>{locale === "zh" ? "实时预览" : "Live preview"} · {presentation.toUpperCase()}</span><div><i /><i /><i /></div></div><div className="studio-preview-scroll"><SiteRenderer generation={generation} spec={spec} studio /></div></main><aside className="studio-agent-pane"><div className="studio-agent-head"><div><span>AGENT</span><h2>{locale === "zh" ? "告诉我怎么改" : "Tell me what to change"}</h2></div><button type="button" onClick={() => setLocale((value) => value === "zh" ? "en" : "zh")}>{locale === "zh" ? "EN" : "中"}</button></div><div className="studio-goal"><label htmlFor="site-intent">{locale === "zh" ? "这个主页主要拿来做什么？" : "What is this site for?"}</label><div><input id="site-intent" value={intent} onChange={(event: ChangeEvent<HTMLInputElement>) => setIntent(event.target.value)} placeholder={locale === "zh" ? "例如：投 Android 系统岗 / 展示 AI 项目" : "e.g. Android systems job search / showcase AI work"} /><button type="button" disabled={busy} onClick={() => void regenerate()}>{locale === "zh" ? "重新策展" : "Re-curate"}</button></div></div><section className="studio-appearance"><div className="studio-appearance-head"><div><span>APPEARANCE</span><h3>{locale === "zh" ? "展示方式" : "Presentation"}</h3></div><small>{locale === "zh" ? "访客不会看到这个开关" : "Visitors never see this control"}</small></div><div className="studio-presentation-grid">{presentationOptions.map((option) => <button type="button" className={`studio-presentation-card${presentation === option.id ? " is-active" : ""}`} onClick={() => choosePresentation(option.id)} key={option.id}><div className={`presentation-thumb is-${option.id}`}><i /><i /><i /></div><b>{option.title}</b><small>{locale === "zh" ? option.zh : option.en}</small></button>)}</div></section><div className="studio-messages">{messages.map((message, index) => <div className={`studio-message is-${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "agent" ? "A" : "YOU"}</span><p>{message.text}</p></div>)}{busy ? <div className="studio-message is-agent is-thinking"><span>A</span><p>{locale === "zh" ? "正在重新组织页面…" : "Reworking the page…"}</p></div> : null}</div><div className="studio-quick-actions">{quickActions[locale].map((action) => <button type="button" disabled={busy} onClick={() => void send(action)} key={action}>{action}</button>)}</div><form className="studio-composer" onSubmit={submit}><input ref={inputRef} value={instruction} onChange={(event: ChangeEvent<HTMLInputElement>) => setInstruction(event.target.value)} maxLength={800} placeholder={locale === "zh" ? "比如：每屏一个项目，或者改成连续浏览…" : "e.g. One project per screen, or switch to continuous flow…"} /><button type="submit" disabled={busy || !instruction.trim()}>↑</button></form><div className="studio-agent-foot"><button type="button" onClick={resetDraft}>{locale === "zh" ? "恢复初始版本" : "Reset to generated"}</button><span>{notice ?? (locale === "zh" ? "草稿自动保存在当前浏览器" : "Draft autosaves in this browser")}</span></div></aside></div></div>;
}
