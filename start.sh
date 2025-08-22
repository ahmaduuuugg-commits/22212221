#!/bin/bash

# RHL Tournament Server Start Script
# This script initializes the Haxball tournament server with proper error handling

echo "🎮 Starting RHL Tournament Server..."

# Set environment variables if not already set
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-5000}

# Check for required environment variables
if [ -z "$HAXBALL_TOKEN" ]; then
    echo "⚠️ Warning: HAXBALL_TOKEN not set, using default"
fi

if [ -z "$DISCORD_WEBHOOK" ]; then
    echo "⚠️ Warning: DISCORD_WEBHOOK not set, using default"
fi

if [ -z "$OWNER_PASSWORD" ]; then
    echo "⚠️ Warning: OWNER_PASSWORD not set, using default"
fi

# Create logs directory
mkdir -p logs

# Function to handle cleanup on exit
cleanup() {
    echo "🛑 Shutting down server..."
    kill $SERVER_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start the server with error handling
start_server() {
    echo "🚀 Launching Node.js server on port $PORT..."
    
    # Start the main server
    node server.js &
    SERVER_PID=$!
    
    echo "✅ Server started with PID: $SERVER_PID"
    
    # Wait for the server process
    wait $SERVER_PID
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -ne 0 ]; then
        echo "❌ Server exited with code $EXIT_CODE"
        echo "🔄 Attempting restart in 10 seconds..."
        sleep 10
        start_server
    fi
}

# Health check function
health_check() {
    sleep 30  # Wait for server to start
    while true; do
        if curl -f http://localhost:$PORT/health > /dev/null 2>&1; then
            echo "✅ Health check passed"
        else
            echo "❌ Health check failed"
        fi
        sleep 60  # Check every minute
    done
}

# Start health check in background
health_check &
HEALTH_PID=$!

# Start the main server
start_server

# Cleanup background processes
kill $HEALTH_PID 2>/dev/null
