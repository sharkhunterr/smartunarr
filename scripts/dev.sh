#!/bin/bash
# Start both backend and frontend

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Starting SmartTunarr Development Servers ==="
echo ""

# Start backend
"$SCRIPT_DIR/dev-back.sh"
echo ""

# Start frontend
"$SCRIPT_DIR/dev-front.sh"
echo ""

echo "=== SmartTunarr is running ==="
echo ""
echo "Backend:  http://localhost:4273"
echo "Frontend: http://localhost:5173"
echo ""
echo "Commands:"
echo "  npm run stop      - Stop all servers"
echo "  npm run logs      - View backend logs"
echo "  npm run logs:front - View frontend logs"
