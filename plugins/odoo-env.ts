/**
 * OdooCLI startup plugin: load Odoo connection settings into the environment
 * before the Odoo MCP server (or any other tool) tries to use them.
 *
 * Resolution order for each variable:
 *   1. Already set in process.env (shell export, parent CI env, etc.) — wins
 *   2. ~/.odoocli/odoo.env (KEY=VALUE per line, # comments OK)
 *   3. Missing → print a banner explaining what to set, create a template
 *      file, and let opencode start anyway. Tool calls that need the missing
 *      vars will fail with a clear error from the MCP server, and the
 *      `odoo` agent prompt instructs the model to handle that conversationally.
 *
 * No interactive stdin prompting: opencode plugins run inside the server
 * process, which doesn't always have a TTY (especially under the desktop
 * app or `opencode serve`). A plain on-disk config file is the reliable
 * channel that works across every launch path.
 */

import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const REQUIRED_KEYS = ["ODOO_URL", "ODOO_DB", "ODOO_USER"] as const
const PASSWORD_KEYS = ["ODOO_PASSWORD", "ODOO_API_KEY"] as const

const ODOOCLI_HOME = process.env.ODOOCLI_HOME ?? join(homedir(), ".odoocli")
const ENV_FILE = join(ODOOCLI_HOME, "odoo.env")

const TEMPLATE = `# OdooCLI connection settings
# Edit this file with your Odoo instance details, then restart opencode.
# Values here are loaded into the environment at startup and passed to the
# bundled Odoo MCP server (see vendor/odoo-mcp-server).
#
# Anything you already 'export' in your shell takes precedence over this file.

ODOO_URL=https://your-instance.odoo.com
ODOO_DB=your-database-name
ODOO_USER=admin

# Use ODOO_PASSWORD on Odoo 17-18.
# Use ODOO_API_KEY on Odoo 19+ (preferred — generate one in Settings → Users).
ODOO_PASSWORD=
# ODOO_API_KEY=
`

function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && value) out[key] = value
  }
  return out
}

function loadEnvFile(): boolean {
  if (!existsSync(ENV_FILE)) return false
  try {
    const parsed = parseEnvFile(readFileSync(ENV_FILE, "utf8"))
    for (const [k, v] of Object.entries(parsed)) {
      if (!process.env[k]) process.env[k] = v
    }
    return true
  } catch (err) {
    process.stderr.write(
      `[odoocli] Failed to read ${ENV_FILE}: ${err instanceof Error ? err.message : String(err)}\n`,
    )
    return false
  }
}

function ensureTemplate(): void {
  if (existsSync(ENV_FILE)) return
  try {
    mkdirSync(ODOOCLI_HOME, { recursive: true })
    writeFileSync(ENV_FILE, TEMPLATE, { mode: 0o600 })
    process.stderr.write(`[odoocli] Created credentials template at ${ENV_FILE}\n`)
  } catch (err) {
    process.stderr.write(
      `[odoocli] Could not create ${ENV_FILE}: ${err instanceof Error ? err.message : String(err)}\n`,
    )
  }
}

function findMissing(): string[] {
  const missing: string[] = []
  for (const k of REQUIRED_KEYS) {
    if (!process.env[k]) missing.push(k)
  }
  if (!PASSWORD_KEYS.some((k) => process.env[k])) {
    missing.push(`${PASSWORD_KEYS.join(" or ")}`)
  }
  return missing
}

function printBanner(missing: string[]): void {
  const lines = [
    "",
    "════════════════════════════════════════════════════════════════",
    " ⚠  OdooCLI is missing Odoo connection settings",
    "",
    `    Missing: ${missing.join(", ")}`,
    "",
    `    Edit  ${ENV_FILE}`,
    "    with your Odoo URL, database, and credentials, then restart.",
    "",
    "    Or export them in your shell:",
    "      export ODOO_URL=https://your-instance.odoo.com",
    "      export ODOO_DB=your-database",
    "      export ODOO_USER=admin",
    "      export ODOO_PASSWORD=...     # or ODOO_API_KEY on Odoo 19+",
    "",
    " OdooCLI will keep running, but Odoo tool calls will fail until",
    " these are set. Ask the agent for help — it knows the drill.",
    "════════════════════════════════════════════════════════════════",
    "",
  ]
  process.stderr.write(lines.join("\n"))
}

function printConnected(): void {
  process.stderr.write(
    `[odoocli] Odoo connection ready: ${process.env.ODOO_URL} ` +
      `(db=${process.env.ODOO_DB}, user=${process.env.ODOO_USER})\n`,
  )
}

const plugin: Plugin = async (_input: PluginInput) => {
  loadEnvFile()
  const missing = findMissing()
  if (missing.length > 0) {
    ensureTemplate()
    printBanner(missing)
  } else {
    printConnected()
  }
  return {}
}

export default {
  id: "odoocli/odoo-env",
  server: plugin,
}
