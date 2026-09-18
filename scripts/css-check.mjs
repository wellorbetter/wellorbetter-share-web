#!/usr/bin/env node
/**
 * CSS declaration validity check.
 *
 * Catches unbalanced parentheses in CSS declaration values. A stray ")" makes
 * the whole declaration invalid, and the CSS parser silently *drops* it — no
 * build error, no console warning, no visual diff on a static screenshot. The
 * rule keeps working; only that one property vanishes.
 *
 * This exists because it already happened here. Stripping the old hardcoded
 * hex fallbacks out of AvatarDropdown.css with
 *
 *     s/var\((--[a-z-]+), [^)]*\)/var(\1)/
 *
 * quietly broke the three fallbacks whose default value contained a *nested*
 * function: `var(--state-hover, rgba(68, 94, 145, 0.08))`. `[^)]*` cannot cross
 * the ")" of the inner rgba(), so the match ended early and left the outer paren
 * behind → `var(--state-hover))`. Result: the avatar dropdown lost its hover and
 * focus-visible backgrounds. Typecheck, build, tests and a contrast audit of the
 * rendered page all passed, because none of them look at states nobody screenshots.
 *
 * Scope note: this also scans the CSS held in template literals inside
 * packages/design/src/tokens.ts. That file is the entire theming substrate for
 * apps/share (styles.css defines no custom properties of its own), yet being a
 * .ts file it is invisible to every CSS tool in the pipeline.
 *
 * Deliberately dependency-free: postcss is only a transitive dep of Vite, and a
 * CI gate should not rest on an undeclared package.
 *
 * Exit 0 if all declaration values balance, exit 1 otherwise.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

function relPath(absPath) {
  return relative(repoRoot, absPath).split(sep).join("/");
}

let violations = 0;

function report(msg) {
  console.error(`  ✗ ${msg}`);
  violations++;
}

/** Blank out comments, preserving newlines so line numbers stay correct. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/**
 * Scan for paren imbalance. Quoted strings are skipped, so a literal paren
 * inside content:"(" or a quoted font name never counts.
 *
 * Reports two failure modes:
 *   - a ")" arriving at depth 0  → stray closer (the bug described above)
 *   - a ";" / "{" / "}" reached while depth > 0 → unclosed opener
 */
function scan(name, rawCss) {
  const css = stripComments(rawCss);
  let depth = 0;
  let line = 1;
  let openLine = 0;
  let quote = null;

  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "\n") { line++; continue; }

    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }

    if (c === "(") {
      if (depth === 0) openLine = line;
      depth++;
    } else if (c === ")") {
      if (depth === 0) {
        report(`${name}:${line}: stray ")" — the declaration it ends is invalid and will be dropped`);
        // Keep scanning; do not go negative, so one typo does not cascade.
      } else {
        depth--;
      }
    } else if (c === ";" || c === "{" || c === "}") {
      if (depth > 0) {
        report(`${name}:${openLine}: unclosed "(" (still open at "${c}" on line ${line})`);
        depth = 0;
      }
    }
  }
  if (depth > 0) report(`${name}:${openLine}: unclosed "(" at end of file`);
}

function findFiles(dir, test, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".wrangler" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) findFiles(full, test, results);
    else if (test(entry)) results.push(full);
  }
  return results;
}

console.log("Checking CSS declaration validity…");
console.log("");

const cssFiles = [
  ...findFiles(join(repoRoot, "apps"), (e) => e.endsWith(".css")),
  ...findFiles(join(repoRoot, "packages"), (e) => e.endsWith(".css")),
];

for (const f of cssFiles) scan(relPath(f), readFileSync(f, "utf-8"));

// CSS that lives inside .ts template literals — invisible to CSS tooling.
const tokensPath = join(repoRoot, "packages", "design", "src", "tokens.ts");
let embedded = 0;
if (existsSync(tokensPath)) {
  const ts = readFileSync(tokensPath, "utf-8");
  const rel = relPath(tokensPath);
  for (const m of ts.matchAll(/export const (\w+)\s*=\s*`([\s\S]*?)`;/g)) {
    const [, exportName, body] = m;
    if (!body.includes("{") || !body.includes(":")) continue; // not CSS
    // Offset the reported line numbers to match the real file.
    const lineOffset = ts.slice(0, m.index).split("\n").length - 1;
    const padded = "\n".repeat(lineOffset) + body;
    scan(`${rel} (${exportName})`, padded);
    embedded++;
  }
}

console.log("");
if (violations === 0) {
  console.log(`✓ CSS check passed (${cssFiles.length} css files, ${embedded} embedded stylesheet(s))`);
  process.exit(0);
} else {
  console.error(`✗ CSS check FAILED: ${violations} invalid declaration(s)`);
  console.error("  An unbalanced paren makes the CSS parser drop that declaration silently.");
  process.exit(1);
}
