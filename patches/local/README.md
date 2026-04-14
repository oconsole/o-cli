# Fork-local source patches

Small, surgical edits to upstream-derived workspace source files
(`packages/opencode/`, `packages/desktop/`, etc.) that we can't move into
extension points (plugins, agents, skills, opencode.json, Tauri overlay).

Run order is the numeric prefix.

| Patch | Target | Why it can't be Tier 0 |
|---|---|---|
| `0001-brand-logo.patch` | `packages/opencode/src/cli/logo.ts` | Hardcoded ASCII constant; no config hook |
| `0002-brand-desktop-i18n-en.patch` | `packages/desktop/src/i18n/en.ts` | i18n is static imports flattened at module load — no runtime overlay slot |
| `0003-brand-desktop-window-title.patch` | `packages/desktop/src-tauri/src/windows.rs` | `.title("OpenCode")` hardcoded; Tauri overlay covers `productName` but not the runtime window title |
| `0004-fix-resign-macos-binaries.patch` | `packages/opencode/script/build.ts` | Real bug fix (Bun `--compile` SIGKILL on Apple Silicon). Candidate for upstream PR. |

> The repo also has a top-level `patches/` dir for **Bun's `node_modules`
> patch system** (e.g. `solid-js@1.9.10.patch`). Those are a different
> mechanism — they're applied by `bun install` automatically. This dir
> (`patches/local/`) is for workspace files and is applied by
> `script/apply-local-patches.ts`.

## Workflow

```bash
# Apply all patches (idempotent — skips already-applied)
bun run script/apply-local-patches.ts

# Check that all patches still apply cleanly (CI guard)
bun run script/apply-local-patches.ts --check

# Reverse all patches (e.g. before pulling upstream)
bun run script/apply-local-patches.ts --revert
```

## When upstream pulls break a patch

`--check` will fail and name the bad patch. Either:

1. **Re-anchor**: open the patch, find the new line numbers/context, regenerate.
2. **Merge upstream's intent in**: if upstream changed the same code, see
   if their version supersedes ours (drop the patch) or needs to be
   combined (rewrite the patch).
3. **Eliminate**: if upstream now exposes a config/extension point that
   covers what the patch did, delete the patch and use the new hook.

## Adding a new patch

1. Make the edit on a clean branch.
2. `git diff <parent> HEAD -- <file> > patches/local/NNNN-short-name.patch`
   (use a per-commit parent diff so the patch isn't contaminated with
   unrelated drift).
3. Revert the source edit, then run
   `bun run script/apply-local-patches.ts` and verify the file matches.
4. Commit only the `.patch` file.
