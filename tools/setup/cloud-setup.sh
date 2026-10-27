#!/bin/bash
# Installs the development tools for SLATE's cloud sessions: the Graphify CLI and five Claude Code
# plugins (Superpowers, Agent Skills, Impeccable, Caveman, Ponytail), all at user scope on the VM.
#
# This file does not run by itself. A cloud session runs only the Setup script saved in the
# environment's settings on claude.ai; paste this file's contents there (tools/setup/README.md says
# how). It can also be run by hand inside a session: bash tools/setup/cloud-setup.sh
#
# Why user scope: a cloud session never installs plugins that a repository's .claude/settings.json
# declares (code.claude.com/docs/en/cloud-environments, "What carries over from your setup", read
# 2026-10-27), so the repository declares none and this script installs them on the VM instead.
#
# It writes nothing inside the repository, is safe to run again, and never fails the session: each
# step that fails prints why and the script still exits 0.
# Not enabled, by decision: Caveman's provider routing and MCP shrink, Ponytail's webhook,
# Graphify's LLM backends (the graph is built from code by local parsing only).

GRAPHIFY_VERSION=0.9.97

say() { printf 'slate-setup: %s\n' "$*"; }

if command -v uv >/dev/null 2>&1; then
  if graphify --version 2>/dev/null | grep -qx "graphify ${GRAPHIFY_VERSION}"; then
    say "graphify ${GRAPHIFY_VERSION} already installed"
  else
    uv tool install --force "graphifyy==${GRAPHIFY_VERSION}" >/dev/null 2>&1 \
      && say "graphify ${GRAPHIFY_VERSION} installed" \
      || say "graphify install failed (uv tool install graphifyy==${GRAPHIFY_VERSION})"
  fi
else
  say "uv not found; graphify not installed"
fi

if ! command -v claude >/dev/null 2>&1; then
  say "claude CLI not found; plugins not installed"
  exit 0
fi

# marketplace repository | plugin@marketplace
PLUGINS="
anthropics/claude-plugins-official superpowers@claude-plugins-official
addyosmani/agent-skills agent-skills@addy-agent-skills
pbakaus/impeccable impeccable@impeccable
JuliusBrussee/caveman caveman@caveman
DietrichGebert/ponytail ponytail@ponytail
"

installed="$(claude plugin list 2>/dev/null)"
known="$(claude plugin marketplace list 2>/dev/null)"
echo "$PLUGINS" | while read -r repo plugin; do
  [ -z "$repo" ] && continue
  market="${plugin#*@}"
  if ! printf '%s\n' "$known" | grep -q "> ${market}\$"; then
    claude plugin marketplace add "$repo" --scope user >/dev/null 2>&1 \
      || say "marketplace ${repo} could not be added"
  fi
  if printf '%s\n' "$installed" | grep -q "> ${plugin}\$"; then
    say "${plugin} already installed"
  else
    claude plugin install "$plugin" --scope user >/dev/null 2>&1 \
      && say "${plugin} installed" \
      || say "${plugin} install failed"
  fi
done

exit 0
