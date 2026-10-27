#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "==> load environment"
source ./env.sh
echo "==> serving $FRONTEND_URL (TLS: $TLS_MODE, API: $API_URL, frontend: $FRONTEND_HOSTING)"

echo "==> write postgres secret file"
mkdir -p secrets
printf '%s' "$POSTGRES_PASSWORD" > secrets/postgres_password.txt
chmod 600 secrets/postgres_password.txt

echo "==> backup before deploy"
if docker ps --format '{{.Names}}' | grep -qx shelfy-postgres; then
  bash ./backup.sh
else
  echo "no running database, skipping"
fi

echo "==> keep current images for rollback"
for image in shelfy-backend shelfy-frontend; do
  if docker image inspect "$image:latest" > /dev/null 2>&1; then
    docker tag "$image:latest" "$image:previous"
  fi
done

echo "==> docker compose pull"
"${compose[@]}" pull postgres caddy

echo "==> docker compose build"
"${compose[@]}" build --pull --no-cache

echo "==> docker compose up -d"
if ! "${compose[@]}" up -d --force-recreate --remove-orphans --wait --wait-timeout 180; then
  echo "deployment failed; rolling back to the previous images" >&2
  rolled_back=false
  for image in shelfy-backend shelfy-frontend; do
    if docker image inspect "$image:previous" > /dev/null 2>&1; then
      docker tag "$image:previous" "$image:latest"
      rolled_back=true
    fi
  done
  if [ "$rolled_back" = true ]; then
    "${compose[@]}" up -d --no-build --force-recreate --wait --wait-timeout 180 || true
    echo "rolled back; database migrations are NOT reverted (see docs/self-hosting.md, restore from docker/backups if needed)" >&2
  fi
  exit 1
fi

echo "==> docker image prune"
docker image prune -f

"${compose[@]}" ps
echo "==> Shelfy $APP_VERSION is running at $FRONTEND_URL"
