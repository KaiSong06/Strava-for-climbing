#!/bin/bash
# Runs all migrations then the test seed inside the Postgres container.
# Mounted at /docker-entrypoint-initdb.d/ so it executes on first startup.
set -e

echo "[init-test-db] applying migrations"
for f in /db/migrations/*.sql; do
  echo "  -> $(basename "$f")"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done

echo "[init-test-db] applying test seed"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /db/seeds/seed_test.sql

echo "[init-test-db] done"
