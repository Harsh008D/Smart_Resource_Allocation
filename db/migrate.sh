#!/bin/bash
set -e

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/volunteer_coordination}"

echo "Running migrations against $DB_URL"

for f in $(dirname "$0")/migrations/*.sql; do
  echo "Applying $f..."
  psql "$DB_URL" -f "$f"
done

echo "All migrations applied."
