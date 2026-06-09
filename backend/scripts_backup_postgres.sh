#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/voleytactics_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL no esta definido"
  exit 1
fi

pg_dump "$DATABASE_URL" | gzip > "$FILE"

echo "Backup generado: $FILE"
