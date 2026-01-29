#!/bin/bash
# Stop frontend server

PID_FILE="/tmp/smarttunarr-frontend.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "Stopping frontend (PID: $PID)..."
        kill "$PID" 2>/dev/null
        sleep 1
        # Force kill if still running
        if kill -0 "$PID" 2>/dev/null; then
            kill -9 "$PID" 2>/dev/null
        fi
        echo "Frontend stopped"
    else
        echo "Frontend not running (stale PID file)"
    fi
    rm -f "$PID_FILE"
else
    echo "No frontend PID file found"
fi

# Also kill any vite dev server
pkill -f "vite.*dev" 2>/dev/null
