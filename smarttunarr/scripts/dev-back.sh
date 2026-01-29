#!/bin/bash
# Start backend server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
LOG_FILE="/tmp/smarttunarr-backend.log"
PID_FILE="/tmp/smarttunarr-backend.pid"

# Kill existing backend if running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "Stopping existing backend (PID: $OLD_PID)..."
        kill "$OLD_PID" 2>/dev/null
        sleep 2
    fi
    rm -f "$PID_FILE"
fi

# Also kill any uvicorn on port 4273
pkill -9 -f "uvicorn.*4273" 2>/dev/null
sleep 1

# Check if port is free
if lsof -i :4273 >/dev/null 2>&1; then
    echo "Port 4273 is still in use. Trying to free it..."
    fuser -k 4273/tcp 2>/dev/null
    sleep 2
fi

echo "Starting backend on port 4273..."
cd "$BACKEND_DIR"
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 4273 --reload > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

sleep 2
if kill -0 $(cat "$PID_FILE") 2>/dev/null; then
    echo "Backend started (PID: $(cat $PID_FILE))"
    echo "Logs: tail -f $LOG_FILE"
else
    echo "Failed to start backend. Check logs: $LOG_FILE"
    cat "$LOG_FILE"
    exit 1
fi
