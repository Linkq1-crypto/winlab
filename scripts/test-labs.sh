#!/usr/bin/env bash

set -e

LABS_DIR="./labs"
COMPOSE_FILE="docker-compose.labs.yml"

echo "Starting WinLab lab smoke test..."

for lab in $(ls "$LABS_DIR"); do
  echo "----------------------------------------"
  echo "Testing lab: $lab"

  export LAB_ID="$lab"

  docker compose -f "$COMPOSE_FILE" up --build -d >/dev/null 2>&1

  sleep 5

  if docker ps | grep -q winlab-lab; then
    echo "Container: OK"
  else
    echo "Container: FAILED"
    docker compose -f "$COMPOSE_FILE" down >/dev/null 2>&1
    continue
  fi

  echo "Running verify..."
  docker exec winlab-lab bash "/labs/$lab/verify.sh" || echo "Verify failed (expected if not fixed)"

  docker compose -f "$COMPOSE_FILE" down >/dev/null 2>&1
done

echo "Done."
