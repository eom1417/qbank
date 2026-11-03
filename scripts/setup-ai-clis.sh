#!/usr/bin/env bash
# The official Claude Code and Codex CLIs: users sign in to their own Claude or ChatGPT
# subscription through them (no API key). Called by setup.sh; safe to re-run.
set -euo pipefail
command -v claude >/dev/null || npm install -g @anthropic-ai/claude-code
command -v codex >/dev/null || npm install -g @openai/codex
command -v script >/dev/null || DEBIAN_FRONTEND=noninteractive apt-get install -y -qq util-linux
