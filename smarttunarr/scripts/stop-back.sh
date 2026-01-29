#!/bin/bash
# Stop backend server

PID_FILE="/tmp/smarttunarr-backend.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "Stopping backend (PID: $PID)..."
        kill "$PID" 2>/dev/null
        sleep 1
        # Force kill if still running
        if kill -0 "$PID" 2>/dev/null; then
            kill -9 "$PID" 2>/dev/null
        fi
        echo "Backend stopped"
    else
        echo "Backend not running (stale PID file)"
    fi
    rm -f "$PID_FILE"
else
    echo "No backend PID file found"
fi

# Also kill any uvicorn on port 4273
pkill -f "uvicorn.*4273" 2>/dev/null
