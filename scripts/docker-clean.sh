#!/usr/bin/env sh
set -eu

echo "Stopping project containers and removing project network..."
docker compose down --remove-orphans

echo "Done. Containers stopped; named volumes preserved."
