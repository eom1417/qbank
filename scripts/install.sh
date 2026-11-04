#!/usr/bin/env bash
# QBank on your own computer, in one command (M16.5): `bash scripts/install.sh [--check] [--with-ai-clis]`.
# macOS (Homebrew) and Linux (apt or dnf); on Windows, inside WSL: `wsl bash scripts/install.sh`.
# This only makes sure Node 24.10+ is there; scripts/install.mjs does the rest.
set -euo pipefail
cd "$(dirname "$0")/.."

node_ok() {
  command -v node >/dev/null &&
    node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>24||(a===24&&b>=10)?0:1)'
}

if ! node_ok; then
  if command -v brew >/dev/null && [ "${1:-}" != "--check" ]; then
    brew install node
  else
    echo "Node 24.10 or newer is needed: https://nodejs.org (LTS), or: nvm install 24 && nvm use 24" >&2
    echo "Then run this script again." >&2
    exit 1
  fi
fi

exec node scripts/install.mjs "$@"
