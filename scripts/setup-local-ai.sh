#!/usr/bin/env bash
# Local AI for QBank (DEC-28): the master key for sealed BYOK keys, and Ollama on loopback with a
# small model. Called by setup.sh; safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

# BYOK keys are sealed under this key (AES-256-GCM); losing it makes saved AI keys unreadable.
if ! grep -q '^QBANK_MASTER_KEY=' .env.local; then
  (umask 077 && printf 'QBANK_MASTER_KEY=%s\n' "$(openssl rand -base64 32)" >> .env.local)
fi
grep -q '^QBANK_LOCAL_AI_URL=' .env.local || echo 'QBANK_LOCAL_AI_URL=http://127.0.0.1:11434/v1' >> .env.local

# Local AI (DEC-28): Ollama on loopback, CPU-only here; models persist in /workspace/.data/ollama.
if ! command -v ollama >/dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh
fi
mkdir -p "$ROOT/.data/ollama" /etc/systemd/system/ollama.service.d
chown -R ollama:ollama "$ROOT/.data/ollama"
printf '[Service]\nEnvironment=OLLAMA_MODELS=%s\nEnvironment=OLLAMA_HOST=127.0.0.1:11434\nEnvironment=OLLAMA_KEEP_ALIVE=10m\n' \
  "$ROOT/.data/ollama" > /etc/systemd/system/ollama.service.d/qbank.conf
systemctl daemon-reload && systemctl restart ollama
# The server needs a moment after a restart before it accepts requests.
for _ in $(seq 30); do ollama list >/dev/null 2>&1 && break; sleep 1; done
ollama pull qwen2.5:0.5b
