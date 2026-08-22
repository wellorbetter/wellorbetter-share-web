#!/usr/bin/env node
/**
 * Contract fixture generator — T007.
 *
 * Extracts the public API surface from packages/shared/src/project.ts and
 * project-policy.ts into a JSON manifest (contract-fixture.json).
 *
 * The fixture captures:
 *   - Exported type aliases and their union members
 *   - Exported const values (error codes, numeric limits, arrays, sets)
 *   - Exported interface field names (shallow)
 *   - Exported function names
 *
 * Usage:
 *   node scripts/generate-fixture.mjs              # write fixture
 *   node scripts/generate-fixture.mjs --verify      # exit 1 if stale
 *   node scripts/generate-fixture.mjs --diff         # show diff vs committed
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharedDir = resolve(__dirname, "../packages/shared/src");
const fixturePath = resolve(__dirname, "../packages/shared/contract-fixture.json");

const args = process.argv.slice(2);
const verifyMode = args.includes("--verify");
const diffMode = args.includes("--diff");

// ─── Extraction helpers (regex-based, no TS compiler needed) ───────

function extractTypeUnions(source) {
  /** Extract `export type Foo = "a" | "b" | "c"` */
  const results = {};
  const re = /export\s+type\s+(\w+)\s*=\s*([\s\S]*?);/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    const body = m[2].trim();
    // Skip compound types (objects, functions, imports)
    if (body.includes("{") || body.includes("=>") || body.includes("import")) continue;
    // Extract string literal members
    const members = [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    if (members.length > 0) {
      results[name] = members.sort();
    } else {
      // Might be a keyof typeof pattern
      results[name] = body;
    }
  }
  return results;
}

function extractConstObjects(source) {
  /** Extract `export const FOO = { ... } as const` */
  const results = {};
  // Match `export const NAME = { ... } as const` or `export const NAME = { ... };`
  const re = /export\s+const\s+(\w+)\s*=\s*\{([\s\S]*?)\}\s*(?:as\s+const)?;/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    const body = m[2];
    // Extract key-value pairs
    const entries = {};
    const kvRe = /(\w+)\s*:\s*("[^"]*"|[\d.]+|true|false|null)/g;
    let kv;
    while ((kv = kvRe.exec(body)) !== null) {
      let val = kv[2];
      if (val.startsWith('"')) val = val.slice(1, -1);
      else if (val === "true") val = true;
      else if (val === "false") val = false;
      else if (val === "null") val = null;
      else val = Number(val);
      entries[kv[1]] = val;
    }
    if (Object.keys(entries).length > 0) {
      results[name] = entries;
    }
  }
  return results;
}

function extractConstPrimitives(source) {
  /** Extract `export const FOO = 42;` or `export const FOO = "bar";` */
  const results = {};
  const re = /export\s+const\s+(\w+)\s*=\s*(\d[\d\s*+]*|"[^"]*"|true|false|null);/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    let val = m[2];
    // Evaluate simple arithmetic like `10 * 1024 * 1024`
    if (/^[\d\s*+]+$/.test(val)) {
      try {
        val = Function(`"use strict"; return (${val})`)();
      } catch {
        // keep as string
      }
    } else if (val.startsWith('"')) {
      val = val.slice(1, -1);
    } else if (val === "true") val = true;
    else if (val === "false") val = false;
    else if (val === "null") val = null;
    results[name] = val;
  }
  return results;
}

function extractConstArrays(source) {
  /** Extract `export const FOO: readonly Type[] = ["a", "b"]` */
  const results = {};
  const re = /export\s+const\s+(\w+)\s*(?::\s*readonly\s+\w+\[\])?\s*=\s*\[([\s\S]*?)\];/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    const body = m[2];
    const items = [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    if (items.length > 0) {
      results[name] = items.sort();
    }
  }
  return results;
}

function extractSetMembers(source) {
  /** Extract `export const FOO = new Set(["a", "b"])` */
  const results = {};
  const re = /export\s+const\s+(\w+)\s*=\s*new\s+Set\s*\(\s*\[([\s\S]*?)\]\s*\)/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    const body = m[2];
    const items = [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    results[name] = items.sort();
  }
  return results;
}

function extractInterfaceFields(source) {
  /** Extract shallow field names from `export interface Foo { ... }` */
  const results = {};
  const re = /export\s+interface\s+(\w+)(?:<[^>]*>)?\s*\{([\s\S]*?)\}/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    const body = m[2];
    const fields = [...body.matchAll(/^\s*(\w+)[\?]?[\s]*:/gm)].map((x) => x[1]);
    if (fields.length > 0) {
      results[name] = fields;
    }
  }
  return results;
}

function extractFunctionNames(source) {
  /** Extract `export function foo(...)` */
  const results = [];
  const re = /export\s+function\s+(\w+)/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    results.push(m[1]);
  }
  return results.sort();
}

// ─── Build fixture ─────────────────────────────────────────────────

function buildFixture() {
  const projectSrc = readFileSync(resolve(sharedDir, "project.ts"), "utf-8");
  const policySrc = readFileSync(resolve(sharedDir, "project-policy.ts"), "utf-8");
  const pkgJson = JSON.parse(readFileSync(resolve(sharedDir, "../package.json"), "utf-8"));

  const fixture = {
    _meta: {
      generator: "generate-fixture.mjs",
      version: pkgJson.version,
      // NOTE: no generatedAt — fixture must be deterministic for byte-identity CI check
      sourceHashes: {
        "project.ts": createHash("sha256").update(projectSrc).digest("hex"),
        "project-policy.ts": createHash("sha256").update(policySrc).digest("hex"),
      },
    },
    project: {
      types: extractTypeUnions(projectSrc),
      constants: {
        ...extractConstPrimitives(projectSrc),
        ...extractConstObjects(projectSrc),
        ...extractConstArrays(projectSrc),
        ...extractSetMembers(projectSrc),
      },
      interfaces: extractInterfaceFields(projectSrc),
    },
    policy: {
      types: extractTypeUnions(policySrc),
      constants: {
        ...extractConstPrimitives(policySrc),
        ...extractConstObjects(policySrc),
        ...extractConstArrays(policySrc),
        ...extractSetMembers(policySrc),
      },
      interfaces: extractInterfaceFields(policySrc),
      functions: extractFunctionNames(policySrc),
    },
  };

  return fixture;
}

// ─── Main ──────────────────────────────────────────────────────────

const fixture = buildFixture();
const json = JSON.stringify(fixture, null, 2) + "\n";

if (verifyMode) {
  if (!existsSync(fixturePath)) {
    console.error("✗ contract-fixture.json does not exist. Run without --verify to generate.");
    process.exit(1);
  }
  const existing = readFileSync(fixturePath, "utf-8");
  if (existing === json) {
    console.log("✓ contract-fixture.json is up-to-date");
    process.exit(0);
  } else {
    console.error("✗ contract-fixture.json is STALE. Run without --verify to regenerate.");
    process.exit(1);
  }
} else if (diffMode) {
  if (!existsSync(fixturePath)) {
    console.log("(no existing fixture to diff against)");
    console.log(json);
  } else {
    const existing = JSON.parse(readFileSync(fixturePath, "utf-8"));
    const newF = JSON.parse(json);
    // Simple key-level diff
    for (const section of ["project", "policy"]) {
      for (const category of ["types", "constants", "interfaces"]) {
        if (!newF[section]?.[category]) continue;
        const oldKeys = new Set(Object.keys(existing[section]?.[category] || {}));
        const newKeys = new Set(Object.keys(newF[section][category]));
        for (const k of newKeys) {
          if (!oldKeys.has(k)) console.log(`+ ${section}.${category}.${k}`);
          else if (
            JSON.stringify(existing[section][category][k]) !==
            JSON.stringify(newF[section][category][k])
          )
            console.log(`~ ${section}.${category}.${k}`);
        }
        for (const k of oldKeys) {
          if (!newKeys.has(k)) console.log(`- ${section}.${category}.${k}`);
        }
      }
      if (newF[section]?.functions) {
        const oldFn = new Set(existing[section]?.functions || []);
        const newFn = new Set(newF[section].functions);
        for (const f of newFn) {
          if (!oldFn.has(f)) console.log(`+ ${section}.functions.${f}`);
        }
        for (const f of oldFn) {
          if (!newFn.has(f)) console.log(`- ${section}.functions.${f}`);
        }
      }
    }
  }
} else {
  writeFileSync(fixturePath, json, "utf-8");
  console.log(`✓ Generated ${fixturePath}`);
  console.log(
    `  ${Object.keys(fixture.project.types).length} types, ` +
      `${Object.keys(fixture.project.constants).length} constants, ` +
      `${Object.keys(fixture.project.interfaces).length} interfaces (project)`,
  );
  console.log(
    `  ${Object.keys(fixture.policy.types).length} types, ` +
      `${Object.keys(fixture.policy.constants).length} constants, ` +
      `${Object.keys(fixture.policy.interfaces).length} interfaces, ` +
      `${fixture.policy.functions.length} functions (policy)`,
  );
}
