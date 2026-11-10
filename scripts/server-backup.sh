#!/bin/sh
# QBank's automatic server backup (M32): the database and the data volume, once a day.
# Runs in the `backup` service of compose.server.yaml (postgres:17-alpine, so pg_dump matches the
# database). Each run writes <BACKUP_DIR>/daily/qbank-YYYY-MM-DD.tar.gz holding db.sql.gz (pg_dump)
# and data.tar.gz (DATA_DIR), keeps the 7 newest days, copies Sunday's into weekly/ (4 kept), and
# writes <BACKUP_DIR>/status.json for the operator's console (backup/run.sh does one run).
#
# Settings (environment): PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE (libpq's own names; the
# password is never printed), DATA_DIR (default /data), BACKUP_DIR (default /backups),
# QBANK_BACKUP_COPY_TO (optional: a folder that also gets each new archive, 7 kept there),
# BACKUP_START_DELAY seconds before the first run (default 120), BACKUP_INTERVAL (default 86400).
# Usage: server-backup.sh [--once]     --once: one run, exit status 0 only when it worked.
set -eu
here=$(dirname "$0")
. "$here/backup/common.sh"

# One run, never fatal to the daily loop: its outcome lands in status.json.
backup_once() {
  mkdir -p "$BACKUP_DIR"
  errors=$(mktemp)
  name="qbank-$(date -u +%F).tar.gz"
  result=0
  sh "$here/backup/run.sh" "$name" 2>"$errors" || result=1
  reason=$(tail -n 1 "$errors")
  rm -rf "$errors" "$BACKUP_DIR"/.work-*
  [ "$result" = 1 ] || { write_status true ''; log "wrote $name"; return 0; }
  write_status false "${reason:-backup failed}"
  log "failed: $reason"
  return 1
}

[ "${1:-}" != --once ] || { backup_once; exit; }
sleep "${BACKUP_START_DELAY:-120}"
while true; do
  backup_once || true
  sleep "${BACKUP_INTERVAL:-86400}"
done
