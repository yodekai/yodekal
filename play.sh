#!/bin/bash
# VaultZone v6.10 — one-shot launcher

cd "$(dirname "$0")"

echo ""
echo "  ╔══════════════════════════════════╗"
echo "  ║   VAULTZONE  v6.10  LAUNCHER      ║"
echo "  ╚══════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "  ✗ Node.js not found."
  echo "  → Install from https://nodejs.org/  (the LTS version)"
  exit 1
fi
NODE_V=$(node -v)
echo "  ✓ Node.js $NODE_V"

# Install deps if missing
if [ ! -d "node_modules" ]; then
  echo ""
  echo "  · Installing dependencies (one-time, ~10 seconds)..."
  npm install --silent
  if [ $? -ne 0 ]; then
    echo "  ✗ npm install failed."
    exit 1
  fi
  echo "  ✓ Installed."
fi

echo ""
echo "  · Starting server..."
echo "  · Open your browser to:  http://localhost:3000"
echo "  · Press Ctrl-C to stop."
echo ""

# Try to open browser automatically (Mac)
if command -v open &> /dev/null; then
  (sleep 1.2 && open "http://localhost:3000") &
fi

node server/index.js
