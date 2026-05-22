#!/usr/bin/env sh
set -eu

echo "Stopping containers and removing project volumes plus locally built images..."
docker compose down --volumes --remove-orphans --rmi local

echo "Done. Containers, network, local images, and named volumes removed."
