import React from "react";
import { createRoot } from "react-dom/client";
import { themeStyle } from "@wellorbetter/design";
import App from "./App.js";
import "./styles.css";

const styleEl = document.createElement("style");
styleEl.textContent = themeStyle;
document.head.appendChild(styleEl);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);