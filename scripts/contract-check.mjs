#!/usr/bin/env node
/**
 * Contract consistency check — T002 / T003 / T007.
 *
 * Verifies that the Project Showcase shared contract files are byte-identical
 * in both repos by comparing SHA-256 hashes, AND that the @wellorbetter/shared
 * package version is the same in both repos.
 *
 * Scope (T007):
 *   - ALL files under packages/shared/src/ (not just project.ts/policy).
 *   - Version consistency in packages/shared/package.json.
 *   - Contract fixture hash (if present).
 *
 * Usage: node scripts/contract-check.mjs
 * Exit 0 if all identical, exit 1 if any mismatch or file missing.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const webSharedDir = resolve(__dirname, "../packages/shared/src");
const apiSharedDir = resolve(
  __dirname,
  "../../wellorbetter-api/packages/shared/src",
);
const webPkgJson = resolve(__dirname, "../packages/shared/package.json");
const apiPkgJson = resolve(
  __dirname,
  "../../wellorbetter-api/packages/shared/package.json",
);
const webFixture = resolve(
  __dirname,
  "../packages/shared/contract-fixture.json",
);
const apiFixture = resolve(
  __dirname,
  "../../wellorbetter-api/packages/shared/contract-fixture.json",
);

function hashFile(path) {
  const content = readFileSync(path, "utf-8");
  return createHash("sha256").update(content).digest("hex");
}

function hashContent(content) {
  return createHash("sha256").update(content).digest("hex");
}

let allPassed = true;
let failDetails = [];

function fail(msg) {
  allPassed = false;
  failDetails.push(msg);
  console.error(`✗ ${msg}`);
}

function pass(msg) {
  console.log(`✓ ${msg}`);
}

// ─── 1. Check ALL shared source files ──────────────────────────────

console.log("── Shared source file hash check ──");

const webFiles = readdirSync(webSharedDir).filter((f) => f.endsWith(".ts"));
const apiFiles = readdirSync(apiSharedDir).filter((f) => f.endsWith(".ts"));

// Check that both repos have the same set of files
const webSet = new Set(webFiles);
const apiSet = new Set(apiFiles);

for (const f of webFiles) {
  if (!apiSet.has(f)) {
    fail(`File ${f} exists in Web but NOT in API repo`);
  }
}
for (const f of apiFiles) {
  if (!webSet.has(f)) {
    fail(`File ${f} exists in API but NOT in Web repo`);
  }
}

// Check byte-identity for files present in both
const commonFiles = webFiles.filter((f) => apiSet.has(f)).sort();
for (const file of commonFiles) {
  const webPath = join(webSharedDir, file);
  const apiPath = join(apiSharedDir, file);
  try {
    const webHash = hashFile(webPath);
    const apiHash = hashFile(apiPath);
    if (webHash === apiHash) {
      pass(`${file}: identical (SHA-256: ${webHash.slice(0, 16)}…)`);
    } else {
      fail(`${file}: DIFFERS between repos`);
      console.error(`  Web: ${webHash}`);
      console.error(`  API: ${apiHash}`);
    }
  } catch (err) {
    fail(`${file}: ${err.message}`);
  }
}

// ─── 2. Check version consistency ──────────────────────────────────

console.log("");
console.log("── @wellorbetter/shared version check ──");

try {
  const webPkg = JSON.parse(readFileSync(webPkgJson, "utf-8"));
  const apiPkg = JSON.parse(readFileSync(apiPkgJson, "utf-8"));
  if (webPkg.version === apiPkg.version) {
    pass(`version identical: ${webPkg.version}`);
  } else {
    fail(
      `version DIFFERS: Web=${webPkg.version}, API=${apiPkg.version}. ` +
        "Both repos must bump @wellorbetter/shared together.",
    );
  }
  if (webPkg.name !== apiPkg.name) {
    fail(`package name DIFFERS: Web=${webPkg.name}, API=${apiPkg.name}`);
  }
} catch (err) {
  fail(`version check error: ${err.message}`);
}

// ─── 3. Check contract fixture consistency (if present) ────────────

console.log("");
console.log("── Contract fixture check ──");

if (existsSync(webFixture) && existsSync(apiFixture)) {
  try {
    const webFixtureHash = hashFile(webFixture);
    const apiFixtureHash = hashFile(apiFixture);
    if (webFixtureHash === apiFixtureHash) {
      pass(`contract-fixture.json: identical (SHA-256: ${webFixtureHash.slice(0, 16)}…)`);
    } else {
      fail("contract-fixture.json: DIFFERS between repos");
      console.error(`  Web: ${webFixtureHash}`);
      console.error(`  API: ${apiFixtureHash}`);
    }
  } catch (err) {
    fail(`fixture check error: ${err.message}`);
  }
} else if (existsSync(webFixture) || existsSync(apiFixture)) {
  fail("contract-fixture.json exists in one repo but not the other");
} else {
  console.log("  (no contract-fixture.json present — run generate-fixture.mjs to create)");
}

// ─── Summary ───────────────────────────────────────────────────────

console.log("");
if (allPassed) {
  console.log(
    `✓ All contract checks passed (${commonFiles.length} files, version + fixture)`,
  );
  process.exit(0);
} else {
  console.error(`\n✗ Contract checks FAILED: ${failDetails.length} issue(s)`);
  console.error(
    "Copy the canonical file(s) from one repo to the other and re-run.",
  );
  console.error(
    "For version mismatches, bump both packages/shared/package.json together.",
  );
  process.exit(1);
}
