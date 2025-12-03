#!/bin/bash

# WaterRower Training System - Quick Start Script

echo "🚣 WaterRower Training System"
echo "=============================="
echo ""

# Check if .env exists, if not create from example
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✅ Created .env file. You can edit it to configure Garmin credentials."
    echo ""
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

# Build the project
echo "Building project..."
npm run build
echo ""

# Start the server
echo "Starting WaterRower Training System..."
echo ""
echo "The web interface will be available at:"
echo "  http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run serve:node
