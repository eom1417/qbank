#!/bin/sh
# One backup run (M32), started by server-backup.sh as its own process so `set -e` holds:
# writes daily/$1 whole or not at all, keeps 7 days and Sunday's in weekly/ (4), and the copy.
# Errors go to stderr, which the caller keeps; the database password is never printed.
set -eu
. "$(dirname "$0")/common.sh"
name=$1
DAILY_KEEP=7
WEEKLY_KEEP=4

# Database and data volume into work folder $1. pipefail is not POSIX, so a failed pg_dump is
# caught by the marker pg_dump writes at the very end of a whole dump.
dump_into() {
  pg_dump --no-owner --no-privileges 2>"$1/pg_dump.err" | gzip >"$1/db.sql.gz"
  gunzip -c "$1/db.sql.gz" | tail -n 8 | grep -q 'PostgreSQL database dump complete' \
    || { echo "pg_dump failed: $(tail -n 1 "$1/pg_dump.err")" >&2; return 1; }
  tar -czf "$1/data.tar.gz" -C "$DATA_DIR" .
}

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"
chmod 700 "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"
work=$(mktemp -d "$BACKUP_DIR/.work-XXXXXX")
dump_into "$work"
tar -cf - -C "$work" db.sql.gz data.tar.gz | gzip -1 >"$work/archive.tmp"
chmod 600 "$work/archive.tmp"
mv -f "$work/archive.tmp" "$BACKUP_DIR/daily/$name"
rm -rf "$work"
prune "$BACKUP_DIR/daily" "$DAILY_KEEP"
[ "$(date -u +%u)" != 7 ] || place_copy "$BACKUP_DIR/daily/$name" "$BACKUP_DIR/weekly"
prune "$BACKUP_DIR/weekly" "$WEEKLY_KEEP"
# The optional second place (a mounted disk or a synced folder): the same 7 days there.
copy_to=${QBANK_BACKUP_COPY_TO:-}
[ -z "$copy_to" ] || place_copy "$BACKUP_DIR/daily/$name" "$copy_to"
[ -z "$copy_to" ] || prune "$copy_to" "$DAILY_KEEP"
