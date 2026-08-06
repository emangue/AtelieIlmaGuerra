#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "deploy/deploy.sh e legado."
echo "Script canonico do Atelie: scripts/deploy.sh"
echo ""

exec "$ROOT_DIR/scripts/deploy.sh" "$@"
