#!/bin/bash
# Stop both backend and frontend

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Stopping SmartTunarr Development Servers ==="
echo ""

# Stop backend
"$SCRIPT_DIR/stop-back.sh"

# Stop frontend
"$SCRIPT_DIR/stop-front.sh"

echo ""
echo "=== All servers stopped ==="
