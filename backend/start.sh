#!/bin/bash
# Quick Start Script for Meeting Joiner with Zoom SDK

set -e

echo "=========================================="
echo "Meeting Joiner - Docker Linux Setup"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

echo "✓ Docker is running"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found"
    echo ""
    echo "Creating .env from example..."
    cp .env.example .env
    echo ""
    echo "📝 Please edit .env with your credentials:"
    echo "   ZOOM_APP_CLIENT_ID=..."
    echo "   ZOOM_APP_CLIENT_SECRET=..."
    echo "   OPENAI_API_KEY=..."
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Check if credentials are set
source .env
if [ -z "$ZOOM_APP_CLIENT_ID" ] || [ -z "$ZOOM_APP_CLIENT_SECRET" ]; then
    echo "❌ Error: Zoom credentials not set in .env"
    echo "Please edit .env and add:"
    echo "   ZOOM_APP_CLIENT_ID=your_id"
    echo "   ZOOM_APP_CLIENT_SECRET=your_secret"
    exit 1
fi

echo "✓ Credentials configured"
echo ""

# Check if py-zoom-meeting-sdk exists
if [ ! -d "../py-zoom-meeting-sdk" ]; then
    echo "❌ Error: py-zoom-meeting-sdk not found"
    echo "Expected location: ../py-zoom-meeting-sdk"
    echo ""
    echo "Please ensure py-zoom-meeting-sdk is in the parent directory:"
    echo "  aiops/"
    echo "  ├── py-zoom-meeting-sdk/"
    echo "  └── meeting-joiner/"
    exit 1
fi

echo "✓ Found py-zoom-meeting-sdk"
echo ""

# Ask if user wants to build or just start
if [ "$1" == "--build" ] || [ ! "$(docker images -q meeting-joiner-worker 2> /dev/null)" ]; then
    echo "🔨 Building Docker images..."
    echo "This will take 10-15 minutes on first run (compiling Zoom SDK)"
    echo ""
    docker-compose build
    echo ""
    echo "✅ Build complete!"
    echo ""
fi

# Start services
echo "🚀 Starting services..."
echo ""
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check service status
echo ""
echo "Service Status:"
echo "----------------------------------------"
docker-compose ps
echo ""

# Check API health
echo "🔍 Checking API health..."
for i in {1..10}; do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ API is healthy!"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "⚠️  API not responding yet (check logs: docker-compose logs api)"
    else
        sleep 2
    fi
done

echo ""
echo "=========================================="
echo "✅ Meeting Joiner is Running!"
echo "=========================================="
echo ""
echo "Services:"
echo "  API:      http://localhost:8000"
echo "  Health:   http://localhost:8000/health"
echo "  Docs:     http://localhost:8000/docs"
echo ""
echo "Useful Commands:"
echo "  View logs:       docker-compose logs -f"
echo "  View worker:     docker-compose logs -f worker"
echo "  Stop services:   docker-compose down"
echo "  Restart:         docker-compose restart"
echo ""
echo "Submit a meeting:"
echo '  curl -X POST http://localhost:8000/meetings \'
echo "    -H 'Content-Type: application/json' \\"
echo '    -d '"'"'{"meeting_url": "https://zoom.us/j/123?pwd=abc"}'"'"
echo ""
echo "Monitor:"
echo "  docker-compose logs -f worker"
echo ""
