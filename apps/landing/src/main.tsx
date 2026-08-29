import React from "react";
import { createRoot } from "react-dom/client";
import { themeStyle } from "@wellorbetter/design";
import App from "./App.js";
import AppService from "./AppService.js";
import PortfolioPage from "./PortfolioPage.js";
import SitePage from "./SitePage.js";
import SiteStudio from "./SiteStudio.js";
import "./styles.css";
import "./portfolio.css";
import "./portfolio-v2.css";
import "./site-agent.css";

const styleEl = document.createElement("style");
styleEl.textContent = themeStyle;
document.head.appendChild(styleEl);

function decodeSegment(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

const path = window.location.pathname;
const siteMatch = path.match(/^\/u\/([^/]+)\/?$/);
const studioMatch = path.match(/^\/studio\/([^/]+)\/?$/);
const portfolioMatch = path.match(/^\/portfolio\/([^/]+)\/?$/);

let content: React.ReactNode;
if (siteMatch) content = <SitePage username={decodeSegment(siteMatch[1]!)} />;
else if (studioMatch) content = <SiteStudio username={decodeSegment(studioMatch[1]!)} />;
else if (portfolioMatch) content = <PortfolioPage username={decodeSegment(portfolioMatch[1]!)} />;
else if (path === "/lab" || path === "/lab/") content = <App />;
else content = <AppService />;

createRoot(document.getElementById("root")!).render(<React.StrictMode>{content}</React.StrictMode>);
