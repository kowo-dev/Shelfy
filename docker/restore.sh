#!/usr/bin/env bash
set -euo pipefail

db_dump="${1:-}"
avatars="${2:-}"
if [ -z "$db_dump" ] || [ ! -f "$db_dump" ] || { [ -n "$avatars" ] && [ ! -f "$avatars" ]; }; then
  echo "usage: restore.sh <db-dump.sql.gz> [avatars.tar.gz]" >&2
  exit 1
fi
db_dump="$(cd "$(dirname "$db_dump")" && pwd)/$(basename "$db_dump")"
[ -z "$avatars" ] || avatars="$(cd "$(dirname "$avatars")" && pwd)/$(basename "$avatars")"

cd "$(dirname "$0")"
source ./env.sh

echo "This replaces the current database content with $db_dump."
read -r -p "Type 'restore' to continue: " answer
[ "$answer" = "restore" ] || { echo "aborted"; exit 1; }

echo "==> stop backend"
"${compose[@]}" stop backend

echo "==> restore database"
gunzip -c "$db_dump" | docker exec -i shelfy-postgres psql -U shelfy -d shelfy -v ON_ERROR_STOP=1 -q

if [ -n "$avatars" ]; then
  echo "==> restore avatars"
  docker run --rm --volumes-from shelfy-backend -v "$(dirname "$avatars"):/in:ro" alpine:3 \
    sh -c "rm -rf /data/avatars/* && tar xzf /in/$(basename "$avatars") -C /data"
fi

echo "==> start backend"
"${compose[@]}" up -d --wait --wait-timeout 180 backend
echo "==> done"
