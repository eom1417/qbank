#!/usr/bin/env bash
# The AI host runs the vendored T3 AI Providers Kit, which needs Node >= 24.10 and pnpm 10
# (the version that wrote its lockfile). Installs Node 24 beside the project's Node, checks the
# vendored files against their lock, installs the kit's exact dependencies, and links them.
set -euo pipefail
cd "$(dirname "$0")/.."
NODE24=/opt/node24

if [ ! -x "$NODE24/bin/node" ]; then
  VERSION="$(curl -fsSL https://nodejs.org/dist/index.json |
    python3 -c "import json,sys; print(next(r['version'] for r in json.load(sys.stdin) if r['version'].startswith('v24.')))")"
  TARBALL="node-$VERSION-linux-x64.tar.xz"
  TMP="$(mktemp -d)"
  curl -fsSL -o "$TMP/$TARBALL" "https://nodejs.org/dist/$VERSION/$TARBALL"
  (cd "$TMP" && curl -fsSL "https://nodejs.org/dist/$VERSION/SHASUMS256.txt" | grep " $TARBALL\$" | sha256sum -c -)
  mkdir -p "$NODE24" && tar -xJf "$TMP/$TARBALL" -C "$NODE24" --strip-components=1
  rm -rf "$TMP"
fi
export PATH="$NODE24/bin:$PATH"

node scripts/vendor-lock.mjs --check
(cd vendor/t3-ai-providers-kit/kit &&
  CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm@10 install --frozen-lockfile --store-dir /root/.cache/pnpm-store)
ln -sfn ../vendor/t3-ai-providers-kit/kit/apps/server/node_modules ai-host/node_modules

# The shared secret between the API and the AI host, generated once into the git-ignored .env.local.
if ! grep -q '^QBANK_AI_HOST_TOKEN=' .env.local; then
  (umask 077 && printf 'QBANK_AI_HOST_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local)
fi
