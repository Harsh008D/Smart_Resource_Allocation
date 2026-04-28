#!/bin/bash
# Run all migrations against the production DATABASE_URL
# Usage: DATABASE_URL=<neon_url> bash db/setup_production.sh

set -e
echo "Running migrations..."
for f in $(dirname "$0")/migrations/*.sql; do
  echo "  Applying $f..."
  psql "$DATABASE_URL" -f "$f"
done

echo "Seeding NGOs and demo users..."
python3 db/seed_production.py

echo "Done!"
