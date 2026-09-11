#!/usr/bin/env bash
set -euo pipefail

MODE="dev"
SKIP_INSTALL=0
SKIP_DOCTOR=0

for arg in "$@"; do
  case "$arg" in
    --prod) MODE="prod" ;;
    --skip-install) SKIP_INSTALL=1 ;;
    --skip-doctor) SKIP_DOCTOR=1 ;;
    *) echo "Unknown option: $arg" ;;
  esac
done

cd "$(dirname "$0")"

echo ""
echo "  RepoDeck launcher"
echo "  ----------------"

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js is required. Install Node.js 22.12+ from https://nodejs.org"
  exit 1
fi

if [ ! -f .env ]; then
  echo "  First run detected: creating .env and generating AUTH_SECRET..."
  node scripts/setup.mjs
fi

if [ "$SKIP_DOCTOR" -eq 0 ]; then
  node scripts/doctor.mjs
fi

if [ "$SKIP_INSTALL" -eq 0 ] && [ ! -d node_modules ]; then
  echo "  Installing dependencies..."
  npm install --no-audit --no-fund
fi

if [ "$MODE" = "prod" ]; then
  echo "  Building production bundle..."
  npm run build
  echo "  Starting RepoDeck on http://localhost:3000"
  npm run start
else
  echo "  Starting RepoDeck in development on http://localhost:3000"
  npm run dev
fi
