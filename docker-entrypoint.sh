#!/bin/sh
set -e

# Apply pending migrations before the app starts. Fails the container if they fail.
echo "Running database migrations"
cd /opt/migrate
./node_modules/.bin/prisma migrate deploy --config ./prisma.config.ts
cd /app

exec "$@"
