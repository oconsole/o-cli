# OdooCLI

**An AI terminal agent for Odoo.** Talk to your Odoo instance in plain English — diagnose health, audit inventory, post invoices, deploy modules, chase stuck cron jobs — without leaving the terminal.

OdooCLI is a fork of [opencode](https://github.com/anomalyco/opencode) preconfigured for Odoo. The general-purpose agent loop, TUI, plugin system, MCP support, and skill discovery are inherited from opencode unchanged. What we add on top is everything Odoo-specific: a bundled Odoo MCP server, a curated Odoo skill pack, and a default `odoo` agent prompt that knows the right tool to reach for.

## What makes it different from upstream opencode

| Ships with | What it gives you |
|---|---|
| **Odoo MCP server** ([`vendor/odoo-mcp-server`](https://github.com/oconsole/odoo-mcp-server)) | 18 native Odoo RPC tools the model calls directly: `odoo_search_read`, `odoo_create`, `odoo_update`, `odoo_doctor`, `odoo_execute`, `odoo_get_fields`, `odoo_get_view`, `odoo_export`, and more. Pre-wired in [`opencode.json`](opencode.json) — no plugin to install. |
| **Odoo skill pack** ([`vendor/odoo-skills`](https://github.com/oconsole/odoo-skills)) | 7 markdown skills auto-discovered via `skills.paths`: `odoo-system-inspect`, `odoo-accounting-inspect`, `odoo-stock-inspect`, `odoo-mrp-inspect`, `odoo-model-inspect`, `odoo-model-customize`, `odoo-model-customize-demo`. The model loads them on demand when the user's question matches their WHEN/DO-NOT-USE conditions. |
| **`odoo` default agent** ([`.opencode/agent/odoo.md`](.opencode/agent/odoo.md)) | Primary agent with an Odoo-tailored system prompt: read-before-write defaults, mutation gating, version-aware field handling, record-ID citations. Set as `default_agent` so `odoocli` drops you into it. |

The point: you run OdooCLI, point it at your Odoo instance, and it already knows how to talk to it.

## Quick start

Requires **Bun 1.3.10+** and **`uv`** (the Odoo MCP server runs as a Python script via `uv run`).

```bash
git clone --recurse-submodules https://github.com/oconsole/odoocli-app.git
cd odoocli-app
bun install
```

> If you already cloned without `--recurse-submodules`, run `git submodule update --init --recursive` to fetch `vendor/odoo-mcp-server` and `vendor/odoo-skills`.

Set your Odoo connection in your shell or `~/.odoocli/.env`:

```bash
export ODOO_URL=https://your-instance.odoo.com
export ODOO_DB=your-database
export ODOO_USER=admin
export ODOO_PASSWORD=your-password      # Odoo 17–18
# export ODOO_API_KEY=...                # preferred on Odoo 19+
```

Then start it:

```bash
bun run dev
```

Once installed globally (see *Distribution* below), the same command becomes:

```bash
odoocli
```

The TUI launches with the `odoo` agent active. The Odoo MCP tools and the seven Odoo skills are ready to go — confirmed by the welcome banner listing them.

## Example session

```
❯ is anything broken on this instance?
  [calls mcp__odoo__odoo_doctor + odoo-system-inspect skill]
  3 issues found:
    • cron "mail.mail_scheduler" has been stuck for 47 min  (ir.cron id=42)
    • 12 messages in the outgoing queue for 2+ hours
    • module `account_edi` has a pending upgrade

❯ list draft invoices over $1000 from this quarter
  [calls mcp__odoo__odoo_search_read on account.move]
  Found 8 invoices: account.move(id=12345), account.move(id=12351), …

❯ post all of them
  → Asks for explicit confirmation, then calls odoo_execute("action_post")

❯ /agent build         # switch to the upstream coding agent for module work
```

## How the wiring works

Three small files do all the work — none of them touch opencode's source code. They use the public config + agent + MCP surfaces opencode already exposes:

```
opencode.json                      ← MCP server + skill paths + default agent
.opencode/agent/odoo.md            ← system prompt for the odoo agent
vendor/odoo-mcp-server/            ← submodule (Python MCP server)
vendor/odoo-skills/                ← submodule (7 SKILL.md files)
```

Want to disable the Odoo agent and use OdooCLI as plain opencode? Press `Tab` to switch to `build` or `plan` — the upstream agents are still there.

## Configuration

| Where | What |
|---|---|
| `opencode.json` (committed) | MCP server, skill paths, default agent |
| `~/.config/opencode/opencode.json` | Global per-user opencode config |
| `~/.odoocli/.env` (or shell) | Odoo credentials (`ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_PASSWORD`/`ODOO_API_KEY`) |
| `.opencode/agent/*.md` | Custom agents (project-scoped) |
| `vendor/odoo-skills/*/SKILL.md` | The bundled Odoo skills (submodule — track upstream) |

## Distribution

OdooCLI builds on opencode's distribution channels. Until we publish our own packaged release, the supported install path is `git clone --recurse-submodules` + `bun install`. Upstream opencode also ships:

- `npm i -g opencode-ai`
- `brew install anomalyco/tap/opencode`
- A native macOS desktop app: `brew install --cask opencode-desktop`
- A `curl | bash` installer

If you want the *upstream* opencode binary plus the OdooCLI wiring, install opencode normally and copy `opencode.json` + `.opencode/agent/odoo.md` + the `vendor/` submodules into any directory you launch from. Opencode auto-loads them.

## Development

```bash
git clone --recurse-submodules https://github.com/oconsole/odoocli-app.git
cd odoocli-app
bun install
bun turbo typecheck --filter=opencode    # typecheck the agent package
bun run dev                              # run the TUI in dev mode
```

The Odoo wiring is just three files — to iterate on the system prompt, edit `.opencode/agent/odoo.md` and reload. To swap in a different MCP server, edit `opencode.json`. To add or update skills, work in the `vendor/odoo-skills` submodule and commit a bumped pointer here.

## Upstream

Everything outside `vendor/`, `opencode.json`, `.opencode/agent/odoo.md`, and this README is upstream opencode code, owned and maintained by [anomalyco](https://github.com/anomalyco/opencode). For agent loop bugs, TUI issues, or model provider questions, file upstream. For Odoo-specific issues — MCP tool bugs, skill content, agent prompt — file here.

## License

MIT, matching upstream opencode. The `vendor/odoo-mcp-server` and `vendor/odoo-skills` submodules are MIT under the same `oconsole` org.
