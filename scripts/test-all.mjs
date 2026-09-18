#!/usr/bin/env node
/**
 * Run every workspace's test suite, and fail if there were none to run.
 *
 * `npm run test --workspaces --if-present` would be the one-liner, but it exits
 * 0 when no workspace declares a "test" script. That is the same shape of bug
 * this repo has already been bitten by twice: a gate that reports success
 * because it did nothing. apps/share has 102 tests that CI never executed, and
 * contract-check exited 0 for months because its sibling checkout was absent.
 *
 * So: enumerate the workspaces, require at least one to have tests, and run
 * them. A workspace with no "test" script is listed as such rather than
 * silently passed over — that list is the honest statement of coverage.
 *
 * Exit 0 only if at least one suite ran and all of them passed.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const rootPkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"));
const patterns = rootPkg.workspaces ?? [];

/**
 * Expand a workspaces pattern to directories. Handles the only two forms this
 * repo uses — "apps/*" and a literal path. Hand-rolled because fs.globSync
 * needs Node 22 and package.json declares engines >=20.
 */
function expand(pattern) {
  if (!pattern.endsWith("/*")) {
    return existsSync(join(repoRoot, pattern)) ? [pattern] : [];
  }
  const parent = pattern.slice(0, -2);
  const parentAbs = join(repoRoot, parent);
  if (!existsSync(parentAbs)) return [];
  return readdirSync(parentAbs)
    .filter((e) => statSync(join(parentAbs, e)).isDirectory())
    .map((e) => `${parent}/${e}`);
}

const withTests = [];
const withoutTests = [];

for (const pattern of patterns) {
  for (const dir of expand(pattern).sort()) {
    const pkgPath = join(repoRoot, dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const name = pkg.name ?? dir;
    if (pkg.scripts?.test) withTests.push({ name, dir });
    else withoutTests.push({ name, dir });
  }
}

console.log(`Workspaces with tests (${withTests.length}):`);
for (const w of withTests) console.log(`  ${w.name}  (${w.dir})`);
if (withoutTests.length) {
  console.log(`Workspaces with NO test script (${withoutTests.length}) — not verified:`);
  for (const w of withoutTests) console.log(`  ${w.name}  (${w.dir})`);
}
console.log("");

if (withTests.length === 0) {
  console.error('✗ No workspace declares a "test" script — nothing was verified.');
  console.error("  If that is intentional, delete this gate rather than letting it pass green.");
  process.exit(1);
}

const failed = [];
for (const w of withTests) {
  console.log(`── ${w.name} ──`);
  const r = spawnSync("npm", ["test", "-w", w.name], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (r.status !== 0) failed.push(w.name);
  console.log("");
}

if (failed.length === 0) {
  console.log(`✓ All tests passed (${withTests.length} workspace(s))`);
  process.exit(0);
}
console.error(`✗ Tests FAILED in: ${failed.join(", ")}`);
process.exit(1);
