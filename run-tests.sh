#!/bin/bash
set -e

PACKAGE="${1:-}"

echo "Building test Docker image..."
docker build -f test.Dockerfile -t thorium-tests .

if [ -n "$PACKAGE" ]; then
    echo "Running tests for package: $PACKAGE"
    docker run --rm thorium-tests cargo test -p "$PACKAGE"
else
    echo "Running all workspace tests..."
    docker run --rm thorium-tests cargo test --workspace
fi
