#!/bin/sh
set -e

# Apply pending migrations before the app starts. Fails the container if they fail.
echo "Running database migrations"
cd /opt/migrate
./node_modules/.bin/prisma migrate deploy --config ./prisma.config.ts
cd /app

# Idempotent and create-only: loads the catalog, requirement rules, interest tags and the pascack.org
# domain on first boot, and never overwrites edits made in the admin. Set RUN_SEED=false to skip.
if [ "${RUN_SEED:-true}" != "false" ]; then
  echo "Seeding reference data"
  node ./seed.mjs
fi

exec "$@"
