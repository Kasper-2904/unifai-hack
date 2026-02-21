#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "PROJECT_SPEC.md"
  "ARCHITECTURE.md"
  "TASKS.md"
  "AGENTS.md"
  "TESTING.md"
  "README.md"
  ".gitignore"
  ".github/workflows/ci.yml"
)

missing=0
for f in "${required_files[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing required file: $f"
    missing=1
  fi
done

required_dirs=(
  "backend"
  "backend/src"
  "backend/data"
  "frontend"
  "frontend/src"
  "frontend/public"
  "docs/shared_context"
)

for d in "${required_dirs[@]}"; do
  if [[ ! -d "$d" ]]; then
    echo "Missing required directory: $d"
    missing=1
  fi
done

if [[ $missing -ne 0 ]]; then
  exit 1
fi

echo "Repo structure validated."
