# OdooCLI

**An AI terminal agent for Odoo.** Talk to your Odoo instance in plain English — diagnose health, audit inventory, post invoices, deploy modules, chase stuck cron jobs — without leaving the terminal.

OdooCLI is a fork of [opencode](https://github.com/anomalyco/opencode) preconfigured for Odoo. The general-purpose agent loop, TUI, plugin system, MCP support, and skill discovery are inherited from opencode unchanged. What we add on top is everything Odoo-specific: a bundled Odoo MCP server, a curated Odoo skill pack, and a default `odoo` agent prompt that knows the right tool to reach for.

## What makes it different from upstream opencode

| Ships with | What it gives you |
|---|---|
| **Odoo MCP server** — git submodule from [`oconsole/odoo-mcp-server`](https://github.com/oconsole/odoo-mcp-server) at [`vendor/odoo-mcp-server`](vendor/odoo-mcp-server) | 18 native Odoo RPC tools the model calls directly: `odoo_search_read`, `odoo_create`, `odoo_update`, `odoo_doctor`, `odoo_execute`, `odoo_get_fields`, `odoo_get_view`, `odoo_export`, and more. Pre-wired in [`opencode.json`](opencode.json) — no plugin to install. |
| **Odoo skill pack** — git submodule from [`oconsole/odoo-skills`](https://github.com/oconsole/odoo-skills) at [`vendor/odoo-skills`](vendor/odoo-skills) | 7 markdown skills auto-discovered via `skills.paths`: `odoo-system-inspect`, `odoo-accounting-inspect`, `odoo-stock-inspect`, `odoo-mrp-inspect`, `odoo-model-inspect`, `odoo-model-customize`, `odoo-model-customize-demo`. The model loads them on demand when the user's question matches their WHEN/DO-NOT-USE conditions. |
| **`odoo` default agent** ([`.opencode/agent/odoo.md`](.opencode/agent/odoo.md)) | Primary agent with an Odoo-tailored system prompt: read-before-write defaults, mutation gating, version-aware field handling, record-ID citations. Set as `default_agent` so `odoocli` drops you into it. |
| **Connection plugin** ([`plugins/odoo-env.ts`](plugins/odoo-env.ts)) | Startup plugin that loads `~/.odoocli/odoo.env` into the environment before any Odoo tool runs. On first launch it creates the file as a template and prints a banner telling you what to fill in — so you never get a silent "connection refused" mid-conversation. |

The point: you run OdooCLI, point it at your Odoo instance, and it already knows how to talk to it.

## Bundled Odoo submodules

The Odoo MCP server and the Odoo skill pack are **already added to this repo as git submodules** — you don't need to install or configure them separately. A `git clone --recurse-submodules` pulls everything in one shot.

| Path | Source repo | Tracks | Purpose |
|---|---|---|---|
| `vendor/odoo-mcp-server` | [`github.com/oconsole/odoo-mcp-server`](https://github.com/oconsole/odoo-mcp-server) | Pinned commit (currently `v0.1.0+2`) | Python FastMCP server exposing 18 Odoo RPC tools |
| `vendor/odoo-skills` | [`github.com/oconsole/odoo-skills`](https://github.com/oconsole/odoo-skills) | `master` branch HEAD | 7 SKILL.md workflows the agent loads on demand |

Both source repos are MIT-licensed and live under the same `oconsole` org, so you (or anyone) can fork them, send PRs, or pin to a specific tag.

**Pulling them in** (only matters if you forgot `--recurse-submodules` on the initial clone):

```bash
git submodule update --init --recursive
```

**Updating them later** (when upstream ships a new release):

```bash
# pull latest from upstream into the submodules
git submodule update --remote vendor/odoo-mcp-server vendor/odoo-skills

# bake the new pointers into this repo
git add vendor/odoo-mcp-server vendor/odoo-skills
git commit -m "chore: bump Odoo submodules"
git push
```

Anyone who pulls afterward gets the same versions automatically.

## Quick start

Two prerequisites: **Bun ≥ 1.3.11** (the agent runtime) and **`uv` ≥ 0.5** (used to launch the Python MCP server — see [About the Python MCP server](#about-the-python-mcp-server) below).

```bash
# macOS
brew install bun uv

# Linux / WSL
curl -fsSL https://bun.sh/install | bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Then clone and install:

```bash
git clone --recurse-submodules https://github.com/oconsole/odoocli-app.git
cd odoocli-app
bun install
```

> If you already cloned without `--recurse-submodules`, run `git submodule update --init --recursive` to fetch `vendor/odoo-mcp-server` and `vendor/odoo-skills`.

Easiest path — run the interactive setup wizard:

```bash
bun run setup
```

It walks you through `ODOO_URL`, `ODOO_DB`, `ODOO_USER`, and your password or API key, then writes them to `~/.odoocli/odoo.env` (mode 0600). Re-run the wizard any time to change values — it shows the current ones in `[brackets]` and lets you press Enter to keep them.

Or edit the file by hand:

```bash
# ~/.odoocli/odoo.env  (auto-created on first launch if it doesn't exist)
ODOO_URL=https://your-instance.odoo.com
ODOO_DB=your-database-name
ODOO_USER=admin
ODOO_PASSWORD=your-password   # Odoo 17–18
# ODOO_API_KEY=...             # preferred on Odoo 19+
```

The startup plugin (`plugins/odoo-env.ts`) reads this file before any Odoo tool runs. Anything you `export` in your shell still wins over the file — useful for CI or transient test connections.

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

## About the Python MCP server

> "OdooCLI is a TypeScript fork of opencode, but the Odoo MCP server is Python — is that a problem?"

**No.** MCP is a JSON-RPC protocol over stdio (or HTTP/SSE for remote servers), not a language binding. The client (opencode) writes JSON-RPC requests to the server's stdin and reads responses from stdout. Whatever's on the other end of those pipes can be Python, Go, Rust, bash — opencode never imports the Python module, it just spawns it as a subprocess. They communicate exclusively through messages.

Concretely:

```
┌──────────────┐                    ┌─────────────────────┐
│   opencode   │   JSON-RPC stdio   │  odoo_mcp_server.py │
│  (TS / Bun)  │ ◄────────────────► │  (Python / FastMCP) │
│              │  init / list_tools │                     │
│  spawns the  │  call_tool         │   talks to Odoo     │
│  server as a │  ...               │   over JSON-RPC     │
│  subprocess  │                    │                     │
└──────────────┘                    └──────────┬──────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │  Odoo instance  │
                                      └─────────────────┘
```

The Python server uses [FastMCP](https://github.com/jlowin/fastmcp), a production-grade Python MCP framework, and ships as a single self-contained script with [PEP 723](https://peps.python.org/pep-0723/) inline metadata declaring its dependencies:

```python
# /// script
# requires-python = ">=3.11"
# dependencies = ["fastmcp>=2.0", "httpx>=0.27"]
# ///
```

When `opencode.json` says `"command": ["uv", "run", "--script", "./vendor/odoo-mcp-server/odoo_mcp_server.py"]`, **`uv` reads that metadata, downloads Python 3.11 if you don't have it, installs `fastmcp` + `httpx` into a cached venv, and runs the script — all in one command, no manual venv setup ever**. That's why `uv` is the second prerequisite alongside Bun.

The benefit of this layout: you get the best Python MCP ecosystem (FastMCP, the `mcp` Python SDK, the huge library of Odoo Python clients) talking through a battle-tested protocol to the best TypeScript agent runtime (opencode's TUI, plugin system, model routing). No Python knowledge required to use OdooCLI; no TypeScript knowledge required to extend the Odoo MCP server.

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
