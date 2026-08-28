import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { generatePersonalSite } from "./agent.js";
import { hasModel } from "./model.js";

const { values } = parseArgs({
  options: {
    github: { type: "string", short: "g" },
    intent: { type: "string", short: "i" },
    locale: { type: "string", short: "l", default: "en" },
    out: { type: "string", short: "o" },
  },
});

const username = values.github?.replace(/^https?:\/\/github\.com\//i, "").replace(/^@/, "").replace(/\/$/, "");
if (!username) {
  console.error("Usage: npm run dev -- --github <username|github-url> [--intent <goal>] [--locale en|zh] [--out site-spec.json]");
  process.exit(1);
}

if (values.locale !== "en" && values.locale !== "zh") {
  console.error("--locale must be 'en' or 'zh'");
  process.exit(1);
}

console.error(`[site-agent] source: github/${username}`);
console.error(`[site-agent] mode: ${hasModel() ? "agentic (model + LangGraph)" : "deterministic fallback (no model key)"}`);
console.error("[site-agent] collect → understand → curate → compose → validate");

const spec = await generatePersonalSite({
  username,
  intent: values.intent,
  locale: values.locale,
});
const output = `${JSON.stringify(spec, null, 2)}\n`;

if (values.out) {
  await writeFile(values.out, output, "utf8");
  console.error(`[site-agent] wrote ${values.out}`);
} else {
  process.stdout.write(output);
}
