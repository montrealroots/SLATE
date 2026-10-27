# Development tools for cloud sessions

Set up on 2026-10-27 at the owner's request. `.claude/rules/dev-tools.md` says which rules win where a tool's
instructions overlap the project's.

| Tool | What is installed | Where it comes from | How it reaches a new session |
| :- | :- | :- | :- |
| Graphify 0.9.97 | the `graphify` CLI | PyPI `graphifyy`, through `uv tool install` | the environment's Setup script |
| Graphify skill and hooks | `.claude/skills/graphify/`, hooks in `.claude/settings.json` | `graphify install --project`, with the hooks made to skip when the CLI is absent | committed in this repository |
| Graphify graph | `graphify-out/` (not committed) | `graphify update .`, local parsing, no LLM | the SessionStart hook in `.claude/settings.json` |
| Superpowers | plugin `superpowers@claude-plugins-official` | `anthropics/claude-plugins-official`, the marketplace its README names first | the environment's Setup script |
| Agent Skills | plugin `agent-skills@addy-agent-skills` | `addyosmani/agent-skills` | the environment's Setup script |
| Impeccable | plugin `impeccable@impeccable` | `pbakaus/impeccable` | the environment's Setup script; telemetry off in `.impeccable/config.json` |
| Caveman | plugin `caveman@caveman` | `JuliusBrussee/caveman` | the environment's Setup script |
| Ponytail | plugin `ponytail@ponytail` | `DietrichGebert/ponytail` | the environment's Setup script |

The plugins are installed at user scope on the session's VM. The repository doesn't declare them, because a cloud
session doesn't install plugins that a repository's `.claude/settings.json` declares
(code.claude.com/docs/en/cloud-environments, "What carries over from your setup", read 2026-10-27).

Left off on purpose: Caveman's provider routing (`caveman enable claude` sets `ANTHROPIC_BASE_URL`) and its MCP
shrink, Ponytail's webhook (its settings stay at their defaults, so nothing leaves the VM), and Graphify's LLM
backends.

## Making it persist: the environment's Setup script

Committing `cloud-setup.sh` doesn't make it run. A cloud session runs only the Setup script saved in its
environment's settings. To add it there from the Claude app on a phone:

1. Open any session in the SLATE environment, in the Code tab.
2. Tap the session's title bar, open the cloud environment menu, and choose **Edit** on the environment.
3. Tap **Setup script**. If the box already holds a script, keep it and add the new lines below it.
4. Paste the whole of `tools/setup/cloud-setup.sh`, from `#!/bin/bash` to the final `exit 0`. Paste the contents,
   not a command that runs the file. The file is on the `claude/new-slate-build` branch only, not on `main`, so a
   command that runs it fails in a session that starts from `main`.
5. Tap **Save changes**.
6. Start a new session. Changing the script makes the environment rebuild its cache, so the first new session takes
   a little longer to start.

## Checking a session

Ask Claude to run `bash tools/setup/verify.sh`. It prints `ok` or `missing` for the Graphify CLI, the graph, the
Graphify skill and each plugin, and changes nothing. A plugin's skills appear in a session only if the plugin was
installed before that session started.

In a session started without the Setup script, Claude can run `bash tools/setup/cloud-setup.sh` by hand. The
Graphify CLI then works at once, but the plugins' skills don't load in that session, and the next session starts on a
fresh VM. Only the Setup script makes them stay.
