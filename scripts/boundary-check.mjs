#!/usr/bin/env node
/**
 * Repository boundary check — T006.
 *
 * Verifies that `wellorbetter-share-web` does not contain API/Worker runtime
 * dependencies or Cloudflare binding references. This repo owns only React
 * Web UI, routing, browser media/iframe policy and static deployment.
 *
 * Checks performed:
 *   1. No `@cloudflare/workers-types` in any app/package package.json
 *      (the static worker.ts only needs the ASSETS binding type inline).
 *   2. No `vitest` or `miniflare` in any package.json (API-side test tools).
 *   3. No `d1_databases`, `r2_buckets`, or `kv_namespaces` in any
 *      `wrangler.toml` under `apps/` (static assets only).
 *   4. No source references to `D1Database`, `R2Bucket`, `KVNamespace` types.
 *   5. No source imports from `wellorbetter-api` paths.
 *
 * Exit 0 if all checks pass, exit 1 if any violation is found.
 * This is a lightweight guard — it does not replace typecheck or build.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

function relPath(absPath) {
  return relative(repoRoot, absPath).split(sep).join("/");
}

const FORBIDDEN_DEPS = [
  "@cloudflare/workers-types",
  "vitest",
  "miniflare",
];

const FORBIDDEN_WRANGLER_SECTIONS = [
  "d1_databases",
  "r2_buckets",
  "kv_namespaces",
];

const FORBIDDEN_TYPE_REFS = [
  /\bD1Database\b/,
  /\bR2Bucket\b/,
  /\bKVNamespace\b/,
];

const FORBIDDEN_IMPORT_PATTERNS = [
  // Match actual imports/requires from the api repo, not comments
  /from\s+["'].*wellorbetter-api/,
  /require\s*\(\s*["'].*wellorbetter-api/,
  /import\s*\(\s*["'].*wellorbetter-api/,
];

let violations = 0;

function report(msg) {
  console.error(`  ✗ ${msg}`);
  violations++;
}

// ─── 1 & 2. Check package.json files for forbidden dependencies ──────

function findPackageJsons(dir, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".wrangler" || entry === "dist") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      findPackageJsons(full, results);
    } else if (entry === "package.json") {
      results.push(full);
    }
  }
  return results;
}

console.log("Checking Web repo boundary (T006)…");
console.log("");

const pkgFiles = [
  ...findPackageJsons(join(repoRoot, "apps")),
  ...findPackageJsons(join(repoRoot, "packages")),
];

for (const pkgPath of pkgFiles) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };
  const rel = relPath(pkgPath);
  for (const dep of FORBIDDEN_DEPS) {
    if (dep in allDeps) {
      report(`${rel}: forbidden dependency "${dep}"`);
    }
  }
}

// ─── 3. Check wrangler.toml for forbidden bindings ───────────────────

function findWranglerTomls(dir, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".wrangler" || entry === "dist") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      findWranglerTomls(full, results);
    } else if (entry === "wrangler.toml") {
      results.push(full);
    }
  }
  return results;
}

const wranglerFiles = findWranglerTomls(join(repoRoot, "apps"));

for (const tomlPath of wranglerFiles) {
  const content = readFileSync(tomlPath, "utf-8");
  const rel = relPath(tomlPath);
  for (const section of FORBIDDEN_WRANGLER_SECTIONS) {
    // Match [[section]] in TOML
    if (content.includes(`[[${section}]]`)) {
      report(`${rel}: forbidden binding section [[${section}]]`);
    }
  }
}

// ─── 4. Check source files for forbidden type references ─────────────

function findSourceFiles(dir, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".wrangler" || entry === "dist") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      findSourceFiles(full, results);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry) && !entry.endsWith(".d.ts")) {
      results.push(full);
    }
  }
  return results;
}

const sourceFiles = [
  ...findSourceFiles(join(repoRoot, "apps")),
  ...findSourceFiles(join(repoRoot, "packages")),
];

for (const srcPath of sourceFiles) {
  const content = readFileSync(srcPath, "utf-8");
  const rel = relPath(srcPath);

  // Check for Cloudflare binding type references
  for (const pattern of FORBIDDEN_TYPE_REFS) {
    if (pattern.test(content)) {
      report(`${rel}: contains forbidden type reference ${pattern}`);
    }
  }

  // Check for cross-repo imports (actual import/require statements, not comments)
  for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
    if (pattern.test(content)) {
      report(`${rel}: contains cross-repo import matching ${pattern}`);
    }
  }
}

// ─── Summary ─────────────────────────────────────────────────────────

console.log("");
if (violations === 0) {
  console.log(`✓ Web boundary check passed (${pkgFiles.length} packages, ${sourceFiles.length} source files, ${wranglerFiles.length} wrangler configs)`);
  process.exit(0);
} else {
  console.error(`✗ Web boundary check FAILED: ${violations} violation(s)`);
  console.error("  wellorbetter-share-web must not depend on Worker/D1/R2/KV runtime.");
  process.exit(1);
}
