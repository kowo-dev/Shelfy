#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: bash docker/verify-email.sh <email>" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx shelfy-postgres; then
  echo "shelfy-postgres is not running" >&2
  exit 1
fi

updated="$(docker exec -i shelfy-postgres psql -U shelfy -d shelfy -qtA -v ON_ERROR_STOP=1 -v email="$1" <<'SQL'
UPDATE users SET email_verified = true
WHERE lower(email) = lower(:'email') AND domain IS NULL
RETURNING username;
SQL
)"

if [ -z "$updated" ]; then
  echo "no account on this instance uses $1" >&2
  exit 1
fi
echo "email confirmed for @$updated"
