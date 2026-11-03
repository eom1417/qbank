#!/usr/bin/env bash
# The master key that seals every user's AI keys (AES-256-GCM). Generated once into the
# git-ignored .env.local; losing it makes saved AI keys unreadable (users re-enter them).
# No AI model is installed here: each user connects their own provider (BYOK, DEC-28).
set -euo pipefail
cd "$(dirname "$0")/.."
if ! grep -q '^QBANK_MASTER_KEY=' .env.local; then
  (umask 077 && printf 'QBANK_MASTER_KEY=%s\n' "$(openssl rand -base64 32)" >> .env.local)
fi
