# Shared by server-backup.sh and server-restore.sh (M32): settings and small file helpers.
# Sourced, never run. DATA_DIR: the data volume; BACKUP_DIR: where archives and status.json live.
DATA_DIR=${DATA_DIR:-/data}
BACKUP_DIR=${BACKUP_DIR:-/backups}
ARCHIVES='qbank-????-??-??.tar.gz'

now_iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }

log() { printf '%s qbank-backup: %s\n' "$(now_iso)" "$*" >&2; }

# Deletes all but the newest $2 archives in folder $1 (their names sort by date).
prune() {
  find "$1" -maxdepth 1 -name "$ARCHIVES" | sort -r | tail -n "+$(($2 + 1))" \
    | while IFS= read -r old; do rm -f "$old"; done
}

# Copies file $1 into folder $2 under the same name, through a temporary file.
place_copy() {
  name=$(basename "$1")
  cp "$1" "$2/.$name.tmp"
  mv -f "$2/.$name.tmp" "$2/$name"
}

# Archives kept on this server, daily and weekly.
count_kept() {
  find "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly" -maxdepth 1 -name "$ARCHIVES" 2>/dev/null \
    | wc -l | tr -d ' '
}

# One line of text, safe inside a JSON string: no control characters, quotes or backslashes.
json_text() {
  printf '%s' "$1" | tr -d '\000-\037\\"' | cut -c1-200
}

# status.json, read by the operator's console: when, whether it worked, how many are kept.
write_status() {
  printf '{"at":"%s","ok":%s,"kept":%s,"error":"%s"}\n' \
    "$(now_iso)" "$1" "$(count_kept)" "$(json_text "$2")" >"$BACKUP_DIR/.status.json.tmp"
  chmod 644 "$BACKUP_DIR/.status.json.tmp"
  mv -f "$BACKUP_DIR/.status.json.tmp" "$BACKUP_DIR/status.json"
}
