#!/bin/sh
# Puts a QBank server back as it was in one backup archive (M32): the whole database and the
# whole data volume are REPLACED by the archive's. Made by server-backup.sh; asks first unless
# --yes. Stop the qbank service before (docs/SELF-HOST.md), so nothing writes meanwhile.
# Settings (environment): PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, DATA_DIR (default /data).
# Usage: server-restore.sh [--yes] <archive.tar.gz>
set -eu
. "$(dirname "$0")/backup/common.sh"

yes=no
[ "${1:-}" != --yes ] || { yes=yes; shift; }
archive=${1:-}
[ -f "$archive" ] || { echo "usage: server-restore.sh [--yes] <archive.tar.gz>" >&2; exit 2; }

if [ "$yes" != yes ]; then
  echo "This REPLACES EVERYTHING: the database '${PGDATABASE:-}' and all files in $DATA_DIR"
  echo "become what they were in $(basename "$archive"). Anything newer is lost."
  printf 'Type yes to continue: '
  read -r answer
  [ "$answer" = yes ] || { echo 'Nothing changed.'; exit 1; }
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
tar -xzf "$archive" -C "$work" db.sql.gz data.tar.gz
gzip -t "$work/db.sql.gz" "$work/data.tar.gz"

log "restoring the database"
{ echo 'SET client_min_messages = warning; DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
  gunzip -c "$work/db.sql.gz"; } \
  | psql -X -q -v ON_ERROR_STOP=1 --single-transaction >/dev/null

log "restoring the data in $DATA_DIR"
find "$DATA_DIR" -mindepth 1 -delete
tar -xzf "$work/data.tar.gz" -C "$DATA_DIR"
log "restored from $(basename "$archive")"
