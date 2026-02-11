#!/bin/bash
set -e

echo "Building coverage Docker image..."
docker build -f coverage.Dockerfile -t thorium-coverage .

echo "Running tests with coverage..."
docker run --rm -v "$(pwd)/coverage:/coverage" thorium-coverage

echo ""
echo "Coverage report generated in ./coverage/html/index.html"
