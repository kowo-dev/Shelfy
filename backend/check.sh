#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

CONTAINER_NAME=shelfy-test-db
PORT=5433

cleanup() {
  docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> starting disposable test database on port $PORT"
docker run -d --rm --name "$CONTAINER_NAME" -p "$PORT:5432" \
  -e POSTGRES_DB=shelfy -e POSTGRES_USER=shelfy -e POSTGRES_PASSWORD=shelfy_local_dev \
  postgres:16-alpine >/dev/null

echo "==> waiting for it to be ready"
until docker exec "$CONTAINER_NAME" pg_isready -U shelfy >/dev/null 2>&1; do
  sleep 0.5
done

echo "==> spotless:check checkstyle:check test"
SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:$PORT/shelfy" \
  ./mvnw spotless:check checkstyle:check test
