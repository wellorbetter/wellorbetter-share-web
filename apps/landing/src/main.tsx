import React from "react";
import { createRoot } from "react-dom/client";
import { themeStyle } from "@wellorbetter/design";
import App from "./App.js";
import AppService from "./AppService.js";
import PortfolioPage from "./PortfolioPage.js";
import SitePage from "./SitePage.js";
import SiteStudio from "./SiteStudio.js";
import { resolveRoute } from "./routes.js";
import { bootstrapTheme } from "./theme.js";
import "./styles.css";
import "./portfolio.css";
import "./portfolio-v2.css";
import "./site-agent.css";
import "./presentation.css";

const styleEl = document.createElement("style");
styleEl.textContent = themeStyle;
document.head.appendChild(styleEl);

// 在 render 之前把存好的明暗选择落到 <html>。放在这里而不是各个页面组件里，
// 是因为 5 个路由只有 2 个有切换按钮 —— 剩下 3 个以前完全无视访客的选择。
bootstrapTheme();

// 路径 → 组件的映射住在 routes.ts，因为 worker 也要用同一份来改写
// <title>/og:/<html lang>。这里只负责挑组件。
const route = resolveRoute(window.location.pathname);

let content: React.ReactNode;
switch (route.kind) {
  case "site":
    content = <SitePage username={route.username} />;
    break;
  case "studio":
    content = <SiteStudio username={route.username} />;
    break;
  case "portfolio":
    content = <PortfolioPage username={route.username} />;
    break;
  case "site-agent":
    content = <AppService />;
    break;
  case "lab":
    content = <App />;
    break;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode>{content}</React.StrictMode>);
