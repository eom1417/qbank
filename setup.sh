#!/usr/bin/env bash
# Rebootstrap a fresh container: PostgreSQL (data persisted in /workspace/.data/postgres),
# Node dependencies, Project Genesis tools, git hooks and database migrations.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"
PGDATA="$ROOT/.data/postgres"

if ! command -v pg_createcluster >/dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq -o DPkg::Lock::Timeout=300 \
    postgresql-16 postgresql-client-16
fi
# The packaged default cluster lives outside /workspace and would not survive; use ours.
pg_lsclusters -h | grep -q '^16 main ' && pg_dropcluster --stop 16 main
if ! pg_lsclusters -h | grep -q '^16 qbank '; then
  mkdir -p "$ROOT/.data"
  # Adopts the existing data directory when present, otherwise initialises a new one.
  pg_createcluster 16 qbank -d "$PGDATA" -p 5432 -- --auth-local=peer --auth-host=scram-sha-256
fi
pg_ctlcluster 16 qbank start 2>/dev/null || true

if [ ! -f .env.local ]; then
  PW="$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
  su postgres -c "psql -q -v ON_ERROR_STOP=1" <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'qbank') THEN CREATE ROLE qbank LOGIN; END IF;
END \$\$;
ALTER ROLE qbank PASSWORD '$PW';
SQL
  for db in qbank qbank_test qbank_e2e; do
    su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='$db'\"" | grep -q 1 ||
      su postgres -c "createdb -O qbank $db"
  done
  (umask 077 && printf 'DATABASE_URL=postgres://qbank:%s@127.0.0.1:5432/qbank\nTEST_DATABASE_URL=postgres://qbank:%s@127.0.0.1:5432/qbank_test\nE2E_DATABASE_URL=postgres://qbank:%s@127.0.0.1:5432/qbank_e2e\n' "$PW" "$PW" "$PW" > .env.local)
fi

bash scripts/setup-local-ai.sh

npm ci
npx playwright install --with-deps chromium
python3 .genesis/tools/genesis.py setup
python3 .genesis/tools/genesis.py hooks
npm run migrate
