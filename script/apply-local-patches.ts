#!/usr/bin/env bun
/**
 * Apply fork-local patches in patches/local/ to the working tree.
 *
 * Run order: numeric prefix (0001, 0002, ...). Patches must be unified
 * diffs against pristine upstream paths (packages/opencode/..., etc.).
 *
 * Modes:
 *   apply         (default) idempotent — skip patches already applied
 *   --check       dry-run; non-zero exit if any patch fails to apply
 *   --revert      reverse-apply (e.g. before regenerating)
 *
 * Use `--check` in CI to detect upstream drift early.
 */

import { $ } from "bun"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const DIR = path.join(ROOT, "patches", "local")

const args = new Set(process.argv.slice(2))
const mode: "apply" | "check" | "revert" = args.has("--check")
  ? "check"
  : args.has("--revert")
    ? "revert"
    : "apply"

if (!fs.existsSync(DIR)) {
  console.log(`No patches/local dir at ${DIR} — nothing to do.`)
  process.exit(0)
}

const patches = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".patch"))
  .sort()

if (patches.length === 0) {
  console.log("No .patch files in patches/local — nothing to do.")
  process.exit(0)
}

let failures = 0
for (const file of patches) {
  const full = path.join(DIR, file)
  // git apply --check / --reverse / (apply); --3way lets clean reverts
  // succeed even if the patch is partially applied already.
  // Probe both directions: a patch is "healthy" if it can be applied
  // forward (not yet applied, would apply cleanly) OR reversed (already
  // applied). Anything else is drift.
  const forwardCheck = await $`git apply --check ${full}`.cwd(ROOT).nothrow().quiet()
  const reverseCheck = await $`git apply --reverse --check ${full}`.cwd(ROOT).nothrow().quiet()
  const isApplied = reverseCheck.exitCode === 0
  const wouldApply = forwardCheck.exitCode === 0

  if (mode === "check") {
    if (isApplied || wouldApply) {
      console.log(`✓ ${file} (${isApplied ? "applied" : "would apply cleanly"})`)
    } else {
      console.error(`✗ ${file} (drift — neither applies forward nor reverses)`)
      failures++
    }
    continue
  }

  if (mode === "apply") {
    if (isApplied) {
      console.log(`✓ ${file} (already applied)`)
      continue
    }
    const result = await $`git apply ${full}`.cwd(ROOT).nothrow()
    if (result.exitCode !== 0) {
      console.error(`✗ ${file} (apply failed)`)
      failures++
    } else {
      console.log(`✓ ${file} (applied)`)
    }
    continue
  }

  // revert
  if (!isApplied) {
    console.log(`✓ ${file} (already reverted)`)
    continue
  }
  const result = await $`git apply --reverse ${full}`.cwd(ROOT).nothrow()
  if (result.exitCode !== 0) {
    console.error(`✗ ${file} (revert failed)`)
    failures++
  } else {
    console.log(`✓ ${file} (reverted)`)
  }
}

if (failures > 0) {
  console.error(`\n${failures} patch(es) failed. Likely upstream drift — see patches/local/README.md.`)
  process.exit(1)
}
