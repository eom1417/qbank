#!/bin/sh
# Runs .genesis/tools/agent_hook.py with whichever Python exists (python3 on macOS/Linux, python on Windows).
PY=$(command -v python3 || command -v python || command -v py)
[ -n "$PY" ] || { echo "Genesis hook: Python 3 not found; install it" >&2; exit 2; }
exec "$PY" "$CLAUDE_PROJECT_DIR/.genesis/tools/agent_hook.py" "$1"
