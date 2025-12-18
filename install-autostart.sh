#!/bin/bash

# WaterRower Training System - Auto-Start Installation Script
# This script sets up the WaterRower system to start automatically at boot

echo "🚣 WaterRower Training System - Auto-Start Setup"
echo "=================================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "📁 Project directory: $SCRIPT_DIR"
echo ""

# Build the project first
echo "🔨 Building project..."
cd "$SCRIPT_DIR"
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix errors before installing the service."
    exit 1
fi
echo "✅ Build successful"
echo ""

# Copy the service file to systemd directory
echo "📋 Installing systemd service..."
cp "$SCRIPT_DIR/waterrower.service" /etc/systemd/system/waterrower.service

# Reload systemd to recognize the new service
echo "🔄 Reloading systemd daemon..."
systemctl daemon-reload

# Enable the service to start at boot
echo "⚡ Enabling service to start at boot..."
systemctl enable waterrower.service

# Start the service now
echo "🚀 Starting service..."
systemctl stop waterrower.service
systemctl start waterrower.service

echo ""
echo "✅ Installation complete!"
echo ""
echo "Service status:"
systemctl status waterrower.service --no-pager -l
echo ""
echo "📝 Useful commands:"
echo "  • Check status:    sudo systemctl status waterrower.service"
echo "  • View logs:       sudo journalctl -u waterrower -f"
echo "  • Stop service:    sudo systemctl stop waterrower.service"
echo "  • Start service:   sudo systemctl start waterrower.service"
echo "  • Restart service: sudo systemctl restart waterrower.service"
echo "  • Disable autostart: sudo systemctl disable waterrower.service"
echo ""
echo "🌐 Web interface available at: http://localhost:3000"
echo ""
