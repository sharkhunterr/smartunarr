#!/bin/bash
# Start frontend server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_DIR/src/frontend"
LOG_FILE="/tmp/smarttunarr-frontend.log"
PID_FILE="/tmp/smarttunarr-frontend.pid"

# Kill existing frontend if running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "Stopping existing frontend (PID: $OLD_PID)..."
        kill "$OLD_PID" 2>/dev/null
        sleep 2
    fi
    rm -f "$PID_FILE"
fi

# Also kill any vite dev server
pkill -f "vite.*dev" 2>/dev/null

echo "Starting frontend..."
cd "$FRONTEND_DIR"
nohup npm run dev > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

sleep 3
if kill -0 $(cat "$PID_FILE") 2>/dev/null; then
    echo "Frontend started (PID: $(cat $PID_FILE))"
    echo "Logs: tail -f $LOG_FILE"
    # Extract the URL from logs
    grep -o "http://localhost:[0-9]*" "$LOG_FILE" | head -1 || echo "Check logs for URL"
else
    echo "Failed to start frontend. Check logs: $LOG_FILE"
    cat "$LOG_FILE"
    exit 1
fi
