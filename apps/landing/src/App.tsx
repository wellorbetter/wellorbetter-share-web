import { useCallback, useEffect, useState } from "react";
import { icon } from "@wellorbetter/design";

type Locale = "zh" | "en";

const copy = {
  zh: {
    nav: ["首页", "产品", "GitHub"],
    heroTitle: "wellorbetter",
    heroSub: "简单、克制的个人数字工具箱",
    cta: "查看产品",
    products: [
      { name: "文件分享", desc: "轻量、安全的文件分享", status: "已上线", href: "https://share.wellorbetterai.com" },
      { name: "应用后台", desc: "旅行 / 骑行路线管理", status: "规划中", href: null },
      { name: "博客", desc: "自动建站与写作", status: "规划中", href: null },
      { name: "文档分享", desc: "AI 文档沙盒安全分享", status: "规划中", href: null },
    ],
    footer: "Powered by Cloudflare",
  },
  en: {
    nav: ["Home", "Products", "GitHub"],
    heroTitle: "wellorbetter",
    heroSub: "A simple, restrained personal toolbox",
    cta: "View products",
    products: [
      { name: "File Share", desc: "Lightweight, secure file sharing", status: "Live", href: "https://share.wellorbetterai.com" },
      { name: "App Backend", desc: "Travel / cycling route management", status: "Planned", href: null },
      { name: "Blog", desc: "Automated blogging & writing", status: "Planned", href: null },
      { name: "Doc Share", desc: "Secure AI doc sandbox sharing", status: "Planned", href: null },
    ],
    footer: "Powered by Cloudflare",
  },
} as const;

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem("wb_locale");
    return saved === "en" ? "en" : "zh";
  });
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("wb_dark");
    if (saved === "1") return true;
    if (saved === "0") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("wb_dark", dark ? "1" : "0");
  }, [dark]);

  useEffect(() => {
    localStorage.setItem("wb_locale", locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const t = copy[locale];

  const toggleDark = useCallback(() => setDark((d) => !d), []);
  const toggleLocale = useCallback(() => setLocale((l) => (l === "zh" ? "en" : "zh")), []);

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand">
          <span dangerouslySetInnerHTML={{ __html: icon("logo", 24) }} />
          <span className="brand-text">wellorbetter</span>
        </div>
        <nav className="landing-links">
          <a href="#products">{t.nav[1]}</a>
          <a href="https://github.com/wellorbetter" target="_blank" rel="noreferrer">
            {t.nav[2]}
          </a>
        </nav>
        <div className="landing-actions">
          <button
            type="button"
            className="ghost-btn icon-btn"
            aria-label="切换深色模式"
            onClick={toggleDark}
            dangerouslySetInnerHTML={{ __html: icon(dark ? "sun" : "moon", 18) }}
          />
          <button type="button" className="ghost-btn" onClick={toggleLocale}>
            {locale === "zh" ? "EN" : "中文"}
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <h1>{t.heroTitle}</h1>
          <p className="hero-sub">{t.heroSub}</p>
          <a className="primary-btn" href="#products">
            {t.cta}
          </a>
        </section>

        <section id="products" className="products">
          {t.products.map((p) => (
            <a
              key={p.name}
              className={`product-card${p.href ? "" : " is-planned"}`}
              href={p.href ?? undefined}
              target={p.href ? "_blank" : undefined}
              rel={p.href ? "noreferrer" : undefined}
            >
              <div className="product-card-top">
                <span
                  className="product-icon"
                  dangerouslySetInnerHTML={{
                    __html: icon(p.name === "文件分享" || p.name === "File Share" ? "upload" : "link", 22),
                  }}
                />
                <span className={`badge${p.status === "已上线" || p.status === "Live" ? " is-live" : ""}`}>
                  {p.status}
                </span>
              </div>
              <h3>{p.name}</h3>
              <p>{p.desc}</p>
            </a>
          ))}
        </section>
      </main>

      <footer className="landing-footer">© 2026 wellorbetter · {t.footer}</footer>
    </div>
  );
}