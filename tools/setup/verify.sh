#!/bin/bash
# Reports whether each development tool is present in this session (tools/setup/README.md).
# Prints one line per tool and exits 1 if any is missing. Changes nothing.

missing=0
ok() { printf 'ok       %s\n' "$*"; }
no() { printf 'missing  %s\n' "$*"; missing=1; }

if v="$(graphify --version 2>/dev/null)"; then ok "graphify CLI ($v)"; else no "graphify CLI"; fi
root="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null)"
if [ -f "$root/graphify-out/graph.json" ]; then ok "graphify graph ($root/graphify-out/graph.json)"; else no "graphify graph (run: GRAPHIFY_BACKEND=none graphify update .)"; fi
if [ -f "$root/.claude/skills/graphify/SKILL.md" ]; then ok "graphify skill (project)"; else no "graphify skill (project)"; fi

list="$(claude plugin list 2>/dev/null)"
for p in superpowers@claude-plugins-official agent-skills@addy-agent-skills impeccable@impeccable caveman@caveman ponytail@ponytail; do
  if printf '%s\n' "$list" | grep -A3 "> ${p}\$" | grep -q 'enabled'; then ok "plugin $p"; else no "plugin $p"; fi
done

exit $missing
