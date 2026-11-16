# The backup image for compose.coolify.yaml: postgres:17-alpine (pg_dump matches the database)
# with QBank's backup and restore scripts built in. Coolify turns a relative bind mount such as
# ./scripts into an empty folder on the server, so the scripts ship inside the image instead.
FROM postgres:17-alpine
COPY scripts/server-backup.sh scripts/server-restore.sh /scripts/
COPY scripts/backup /scripts/backup
