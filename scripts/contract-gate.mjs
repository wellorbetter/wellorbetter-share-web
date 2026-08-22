#!/usr/bin/env node
/**
 * Contract compatibility gate — T007.
 *
 * Compares two contract fixture JSON files and classifies changes as
 * BREAKING or COMPATIBLE according to the versioning rules in
 * repository-boundaries.md §3.1.
 *
 * BREAKING (requires MAJOR bump + compatibility window):
 *   - Removed exported type, constant, interface, or function
 *   - Changed value of a constant (error code string, numeric limit)
 *   - Removed a member from a type union (e.g. removed status enum value)
 *   - Removed a field from an interface
 *
 * COMPATIBLE (MINOR or PATCH bump):
 *   - Added new exported type, constant, interface, or function
 *   - Added a member to a type union (e.g. new status enum value)
 *   - Added an optional field to an interface
 *
 * Usage:
 *   node scripts/contract-gate.mjs <old-fixture.json> <new-fixture.json>
 *
 * Exit 0 if only compatible changes (or no changes).
 * Exit 1 if any breaking changes detected.
 * Exit 2 if usage error.
 */

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args.length < 2 || args.includes("--help")) {
  console.error(
    "Usage: node scripts/contract-gate.mjs <old-fixture.json> <new-fixture.json>",
  );
  process.exit(2);
}

const [oldPath, newPath] = args;

let oldF, newF;
try {
  oldF = JSON.parse(readFileSync(oldPath, "utf-8"));
} catch (e) {
  console.error(`Error reading old fixture: ${e.message}`);
  process.exit(2);
}
try {
  newF = JSON.parse(readFileSync(newPath, "utf-8"));
} catch (e) {
  console.error(`Error reading new fixture: ${e.message}`);
  process.exit(2);
}

const breaking = [];
const compatible = [];

function checkSection(sectionName, oldSection, newSection) {
  if (!oldSection && !newSection) return;
  oldSection = oldSection || {};
  newSection = newSection || {};

  // ─── Types ─────────────────────────────────────────────────────
  const oldTypes = oldSection.types || {};
  const newTypes = newSection.types || {};

  for (const name of Object.keys(oldTypes)) {
    if (!(name in newTypes)) {
      breaking.push(`${sectionName}.types: removed type "${name}"`);
      continue;
    }
    const oldMembers = oldTypes[name];
    const newMembers = newTypes[name];
    // Both are arrays of union members
    if (Array.isArray(oldMembers) && Array.isArray(newMembers)) {
      const oldSet = new Set(oldMembers);
      const newSet = new Set(newMembers);
      for (const m of oldMembers) {
        if (!newSet.has(m)) {
          breaking.push(
            `${sectionName}.types.${name}: removed union member "${m}"`,
          );
        }
      }
      for (const m of newMembers) {
        if (!oldSet.has(m)) {
          compatible.push(
            `${sectionName}.types.${name}: added union member "${m}"`,
          );
        }
      }
    } else if (JSON.stringify(oldMembers) !== JSON.stringify(newMembers)) {
      breaking.push(`${sectionName}.types.${name}: type definition changed`);
    }
  }
  for (const name of Object.keys(newTypes)) {
    if (!(name in oldTypes)) {
      compatible.push(`${sectionName}.types: added type "${name}"`);
    }
  }

  // ─── Constants ─────────────────────────────────────────────────
  const oldConst = oldSection.constants || {};
  const newConst = newSection.constants || {};

  /**
   * Deep-compare two constant values. For plain objects, compare key-by-key
   * so that adding new keys is COMPATIBLE while removing or changing is BREAKING.
   * For arrays, compare element-by-element (sorted) so additions are COMPATIBLE.
   * For primitives, strict JSON equality.
   */
  function compareConstValue(name, oldVal, newVal) {
    const oldIsObj = oldVal !== null && typeof oldVal === "object" && !Array.isArray(oldVal);
    const newIsObj = newVal !== null && typeof newVal === "object" && !Array.isArray(newVal);
    const oldIsArr = Array.isArray(oldVal);
    const newIsArr = Array.isArray(newVal);

    // Type changed (e.g. object → primitive) — breaking
    if (oldIsObj !== newIsObj || oldIsArr !== newIsArr) {
      breaking.push(
        `${sectionName}.constants.${name}: type changed ` +
          `(${JSON.stringify(oldVal)} → ${JSON.stringify(newVal)})`,
      );
      return;
    }

    // Both are plain objects — compare key-by-key
    if (oldIsObj && newIsObj) {
      const oldKeys = new Set(Object.keys(oldVal));
      const newKeys = new Set(Object.keys(newVal));
      for (const k of oldKeys) {
        if (!newKeys.has(k)) {
          breaking.push(`${sectionName}.constants.${name}: removed key "${k}"`);
        } else if (JSON.stringify(oldVal[k]) !== JSON.stringify(newVal[k])) {
          breaking.push(
            `${sectionName}.constants.${name}.${k}: value changed ` +
              `(${JSON.stringify(oldVal[k])} → ${JSON.stringify(newVal[k])})`,
          );
        }
      }
      for (const k of newKeys) {
        if (!oldKeys.has(k)) {
          compatible.push(`${sectionName}.constants.${name}: added key "${k}"`);
        }
      }
      return;
    }

    // Both are arrays — compare sorted elements
    if (oldIsArr && newIsArr) {
      const oldSorted = [...oldVal].sort();
      const newSorted = [...newVal].sort();
      const oldSet = new Set(oldSorted);
      const newSet = new Set(newSorted);
      for (const item of oldSorted) {
        if (!newSet.has(item)) {
          breaking.push(`${sectionName}.constants.${name}: removed element "${item}"`);
        }
      }
      for (const item of newSorted) {
        if (!oldSet.has(item)) {
          compatible.push(`${sectionName}.constants.${name}: added element "${item}"`);
        }
      }
      return;
    }

    // Primitives — strict equality
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      breaking.push(
        `${sectionName}.constants.${name}: value changed ` +
          `(${JSON.stringify(oldVal)} → ${JSON.stringify(newVal)})`,
      );
    }
  }

  for (const name of Object.keys(oldConst)) {
    if (!(name in newConst)) {
      breaking.push(`${sectionName}.constants: removed constant "${name}"`);
      continue;
    }
    compareConstValue(name, oldConst[name], newConst[name]);
  }
  for (const name of Object.keys(newConst)) {
    if (!(name in oldConst)) {
      compatible.push(`${sectionName}.constants: added constant "${name}"`);
    }
  }

  // ─── Interfaces ────────────────────────────────────────────────
  const oldIface = oldSection.interfaces || {};
  const newIface = newSection.interfaces || {};

  for (const name of Object.keys(oldIface)) {
    if (!(name in newIface)) {
      breaking.push(`${sectionName}.interfaces: removed interface "${name}"`);
      continue;
    }
    const oldFields = new Set(oldIface[name]);
    const newFields = new Set(newIface[name]);
    for (const f of oldIface[name]) {
      if (!newFields.has(f)) {
        breaking.push(
          `${sectionName}.interfaces.${name}: removed field "${f}"`,
        );
      }
    }
    for (const f of newIface[name]) {
      if (!oldFields.has(f)) {
        compatible.push(
          `${sectionName}.interfaces.${name}: added field "${f}"`,
        );
      }
    }
  }
  for (const name of Object.keys(newIface)) {
    if (!(name in oldIface)) {
      compatible.push(`${sectionName}.interfaces: added interface "${name}"`);
    }
  }

  // ─── Functions ─────────────────────────────────────────────────
  const oldFn = new Set(oldSection.functions || []);
  const newFn = new Set(newSection.functions || []);

  for (const f of oldSection.functions || []) {
    if (!newFn.has(f)) {
      breaking.push(`${sectionName}.functions: removed function "${f}"`);
    }
  }
  for (const f of newSection.functions || []) {
    if (!oldFn.has(f)) {
      compatible.push(`${sectionName}.functions: added function "${f}"`);
    }
  }
}

checkSection("project", oldF.project, newF.project);
checkSection("policy", oldF.policy, newF.policy);

// ─── Report ────────────────────────────────────────────────────────

console.log("── Contract compatibility gate (T007) ──");
console.log("");

if (breaking.length === 0 && compatible.length === 0) {
  console.log("✓ No contract changes detected");
  process.exit(0);
}

if (breaking.length > 0) {
  console.error(`✗ BREAKING changes: ${breaking.length}`);
  for (const b of breaking) console.error(`  ✗ ${b}`);
  console.error("");
  console.error(
    "  → Requires MAJOR version bump and compatibility window.",
  );
  console.error(
    "  → See repository-boundaries.md §3.1 for versioning rules.",
  );
}

if (compatible.length > 0) {
  console.log(`✓ Compatible changes: ${compatible.length}`);
  for (const c of compatible) console.log(`  + ${c}`);
  console.log("");
  console.log("  → MINOR or PATCH version bump is sufficient.");
}

console.log("");
if (breaking.length > 0) {
  console.error(`✗ Gate FAILED: ${breaking.length} breaking change(s)`);
  process.exit(1);
} else {
  console.log(`✓ Gate PASSED: ${compatible.length} compatible change(s), 0 breaking`);
  process.exit(0);
}
