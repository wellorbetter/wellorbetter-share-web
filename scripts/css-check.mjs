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
 * It also scans opendesign/ — both .css files and <style> blocks inside .html.
 * Those are the brand token sheet and the landing mockup, and they are the
 * *least* protected code here: nothing builds them, so there is no bundler to
 * complain and no test to fail.
 *
 * Deliberately dependency-free: postcss is only a transitive dep of Vite, and a
 * CI gate should not rest on an undeclared package.
 *
 * Second check, same failure shape: every root-relative url(/…) must resolve to a
 * real file on every origin that serves the stylesheet. A dangling one does not
 * fail the build — the browser 404s it and falls back to the next font in the
 * stack, so a broken @font-face just reads as "the brand serif isn't loading
 * today". "Every origin that serves it" rather than "somewhere in the repo"
 * because each app is its own Worker on its own hostname with its own copy of
 * public/, and the browser resolves url(/…) against whoever served the CSS. The
 * shared token sheet is declared by both sites; the font was shipped by one.
 *
 * Third check: hashed filenames must still describe their bytes. Several copies
 * of one asset plus a hand-written sha256 prefix plus `immutable` in _headers is
 * drift with a one-year blast radius, so verify the copies are identical and the
 * prefix is really the content's.
 *
 * Exit 0 if all declaration values balance, all asset URLs resolve on every
 * origin that needs them, and every hashed name matches its content; 1 otherwise.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
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

/**
 * Every stylesheet scanned above, kept so the asset check below can re-read it
 * without walking the tree twice. Populated by scanAndKeep.
 */
const scanned = [];
function scanAndKeep(name, css) {
  scan(name, css);
  scanned.push({ name, css });
}

console.log("Checking CSS declaration validity…");
console.log("");

const cssFiles = [
  ...findFiles(join(repoRoot, "apps"), (e) => e.endsWith(".css")),
  ...findFiles(join(repoRoot, "packages"), (e) => e.endsWith(".css")),
  // opendesign/ ships the brand token sheet and the landing mockup. It is not
  // built, so a dropped declaration there is even quieter than in apps/.
  ...findFiles(join(repoRoot, "opendesign"), (e) => e.endsWith(".css")),
];

for (const f of cssFiles) scanAndKeep(relPath(f), readFileSync(f, "utf-8"));

// CSS inside <style> blocks in HTML — the opendesign mockups keep their whole
// stylesheet inline, so none of it is reachable by a .css glob.
let inlineBlocks = 0;
for (const f of findFiles(join(repoRoot, "opendesign"), (e) => e.endsWith(".html"))) {
  const html = readFileSync(f, "utf-8");
  const rel = relPath(f);
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const lineOffset = html.slice(0, m.index).split("\n").length - 1;
    scanAndKeep(`${rel} (<style>)`, "\n".repeat(lineOffset) + m[1]);
    inlineBlocks++;
  }
}

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
    scanAndKeep(`${rel} (${exportName})`, padded);
    embedded++;
  }
}

// ─── Asset references: every url(/…) must resolve to a real file ───────────
//
// A font or image url() that points at nothing does not fail the build and does
// not throw. The browser 404s the request and silently uses the next family in
// the stack — so a broken @font-face reads as "Fraunces just looks like Georgia
// today". Nothing else in the pipeline can catch it: Vite copies public/
// verbatim without resolving these URLs, and the token sheet is a .ts template
// literal so no bundler ever parses its url().
//
// The font filename carries a hand-written content hash (public/ is copied as-is,
// so Vite will not hash it) precisely so _headers can mark it immutable. That
// makes a rename a two-place edit, which is exactly the kind of thing that gets
// half-done.
const apps = readdirSync(join(repoRoot, "apps")).filter((app) =>
  existsSync(join(repoRoot, "apps", app, "public")),
);
const publicRoot = (app) => join(repoRoot, "apps", app, "public");

/**
 * Which apps serve the shared token sheet.
 *
 * `url(/…)` is resolved by the *browser*, against whatever origin loaded the
 * stylesheet — so "this file exists somewhere in the monorepo" is the wrong
 * question. Each app is its own Worker on its own hostname, and public/ is
 * copied per app, so an asset has to be shipped once per origin that references
 * it. That is what the first version of this check got wrong: it accepted a
 * match under *any* app's public directory, which is how the brand serif ended
 * up declared on both sites and shipped on only one.
 *
 * The indirection matters: the sheet holding @font-face is `cssVariables`, but
 * no app names it — they import `themeStyle`, which is `cssVariables` glued to
 * `baseStyles`. So resolve re-exports first, or this answers "nobody" and the
 * check silently goes back to passing (it did, on the first attempt).
 */
const tokensSource = existsSync(tokensPath) ? readFileSync(tokensPath, "utf-8") : "";

/** Export names that transitively include `sheet`, `sheet` itself included. */
function entryPointsFor(sheet) {
  const bodies = new Map();
  for (const m of tokensSource.matchAll(/export const (\w+)\s*=\s*([\s\S]*?);\n/g)) {
    bodies.set(m[1], m[2]);
  }
  const reachable = new Set([sheet]);
  // Fixed point: an export that mentions something already reachable is itself
  // an entry point to it.
  for (let changed = true; changed; ) {
    changed = false;
    for (const [name, body] of bodies) {
      if (reachable.has(name)) continue;
      for (const seen of reachable) {
        if (new RegExp(`\\b${seen}\\b`).test(body)) {
          reachable.add(name);
          changed = true;
          break;
        }
      }
    }
  }
  return reachable;
}

function appsImporting(sheet) {
  const names = entryPointsFor(sheet);
  const hit = [];
  for (const app of apps) {
    const src = join(repoRoot, "apps", app, "src");
    if (!existsSync(src)) continue;
    const files = [];
    (function walk(dir) {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(entry)) files.push(p);
      }
    })(src);
    const used = files.some((f) => {
      const text = readFileSync(f, "utf-8");
      if (!/@wellorbetter\/design/.test(text)) return false;
      return [...names].some((n) => new RegExp(`\\b${n}\\b`).test(text));
    });
    if (used) hit.push(app);
  }
  return hit;
}

/**
 * The origins a given stylesheet's assets must be present on.
 *
 * - `apps/<app>/…` — only that app serves it.
 * - the shared token sheet — every app that pulls the matching export in.
 * - anything else (opendesign/ mockups) — nothing serves it over HTTP, so fall
 *   back to "must exist somewhere" rather than inventing an owner.
 */
function originsFor(name) {
  const own = name.match(/^apps\/([^/]+)\//);
  if (own && apps.includes(own[1])) return { required: [own[1]], lenient: false };
  const shared = name.match(/^packages\/design\/src\/tokens\.ts \((\w+)\)$/);
  if (shared) {
    const consumers = appsImporting(shared[1]);
    if (consumers.length) return { required: consumers, lenient: false };
  }
  return { required: apps, lenient: true };
}

let assetRefs = 0;
const checkedAssets = new Set();
for (const { name, css } of scanned) {
  const body = stripComments(css);
  const { required, lenient } = originsFor(name);
  for (const m of body.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const url = m[1].trim();
    // Only root-relative paths are checkable here. data:, http(s): and relative
    // paths are resolved by the bundler or the network, not by public/.
    if (!url.startsWith("/")) continue;
    assetRefs++;
    const rel = url.replace(/[?#].*$/, "").slice(1);
    const missing = required.filter((app) => !existsSync(join(publicRoot(app), rel)));
    const line = () => body.slice(0, m.index).split("\n").length;
    if (lenient) {
      if (missing.length === required.length) {
        report(
          `${name}:${line()}: url(${url}) matches no file under ` +
            `${required.map((a) => relPath(publicRoot(a))).join(", ") || "any apps/*/public"} — ` +
            `the browser will 404 and silently fall back`,
        );
      }
    } else if (missing.length) {
      report(
        `${name}:${line()}: url(${url}) is served by ${required.join(", ")} but the file is ` +
          `missing from ${missing.map((a) => relPath(publicRoot(a))).join(", ")} — ` +
          `that origin will 404 and silently fall back`,
      );
    }
    checkedAssets.add(rel);
  }
}

// ─── Hashed assets: the name must still describe the bytes ──────────────────
//
// Shipping the same asset from several origins means several copies, and the
// filename carries a hand-written sha256 prefix so _headers can call it
// `immutable`. Both of those are drift waiting to happen: re-subset the font and
// you must update the token sheet plus every copy, and `immutable` means a
// visitor who cached the old bytes under the new name keeps them for a year.
//
// So verify what the name claims: every copy identical, and the hash prefix
// actually derived from the content. Cheap, and it makes the cache header honest
// instead of aspirational.
let hashedAssets = 0;
for (const rel of checkedAssets) {
  const copies = apps
    .map((app) => ({ app, path: join(publicRoot(app), rel) }))
    .filter((c) => existsSync(c.path));
  if (copies.length === 0) continue;
  const digests = copies.map((c) => ({
    ...c,
    sha: createHash("sha256").update(readFileSync(c.path)).digest("hex"),
  }));
  const [first, ...rest] = digests;
  for (const other of rest) {
    if (other.sha !== first.sha) {
      report(
        `${rel}: ${first.app} and ${other.app} ship different bytes under the same name — ` +
          `whichever origin a visitor cached first wins, and _headers says immutable`,
      );
    }
  }
  const claimed = rel.match(/\.([0-9a-f]{8})\.[^.]+$/);
  if (claimed) {
    hashedAssets++;
    if (!first.sha.startsWith(claimed[1])) {
      report(
        `${rel}: filename claims sha256 ${claimed[1]} but the content hashes to ` +
          `${first.sha.slice(0, 8)} — rename it (and the url() referencing it), or returning ` +
          `visitors keep the old bytes under immutable for a year`,
      );
    }
  }
}

console.log("");
if (violations === 0) {
  console.log(
    `✓ CSS check passed (${cssFiles.length} css files, ` +
      `${inlineBlocks} inline <style> block(s), ${embedded} embedded stylesheet(s), ` +
      `${assetRefs} asset url(/…) reference(s) resolved)`,
  );
  process.exit(0);
} else {
  console.error(`✗ CSS check FAILED: ${violations} problem(s)`);
  console.error("  An unbalanced paren makes the CSS parser drop that declaration silently;");
  console.error("  a dangling url() 404s and falls back to the next font/background silently.");
  process.exit(1);
}
