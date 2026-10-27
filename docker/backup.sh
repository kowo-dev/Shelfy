#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

keep="${1:-14}"
dir="backups"
stamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$dir"
chmod 700 "$dir"

if ! docker ps --format '{{.Names}}' | grep -qx shelfy-postgres; then
  echo "shelfy-postgres is not running; nothing to back up" >&2
  exit 1
fi

echo "==> dump database"
docker exec shelfy-postgres pg_dump -U shelfy --no-owner --clean --if-exists shelfy \
  | gzip > "$dir/db-$stamp.sql.gz"
if ! gzip -t "$dir/db-$stamp.sql.gz" || [ ! -s "$dir/db-$stamp.sql.gz" ]; then
  rm -f "$dir/db-$stamp.sql.gz"
  echo "database dump failed" >&2
  exit 1
fi

if docker ps -a --format '{{.Names}}' | grep -qx shelfy-backend; then
  echo "==> archive avatars"
  docker run --rm --volumes-from shelfy-backend:ro -v "$PWD/$dir:/out" alpine:3 \
    tar czf "/out/avatars-$stamp.tar.gz" -C /data avatars
fi

echo "==> prune (keep $keep)"
for prefix in db avatars; do
  { ls -1t "$dir"/$prefix-* 2>/dev/null || true; } | tail -n +$((keep + 1)) | xargs rm -f --
done

echo "==> done: $dir/db-$stamp.sql.gz"
