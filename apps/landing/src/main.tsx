import React from "react";
import { createRoot } from "react-dom/client";
import { themeStyle } from "@wellorbetter/design";
import AppService from "./AppService.js";
import PortfolioPage from "./PortfolioPage.js";
import "./styles.css";

const styleEl = document.createElement("style");
styleEl.textContent = themeStyle;
document.head.appendChild(styleEl);

const match = window.location.pathname.match(/^\/u\/([^/]+)\/?$/);
const content = match ? <PortfolioPage username={decodeURIComponent(match[1]!)} /> : <AppService />;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {content}
  </React.StrictMode>,
);
