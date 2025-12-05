#!/bin/bash
# SSL/TLS Certificate Setup Script for WaterRower Training System
# This script helps set up HTTPS with Let's Encrypt or self-signed certificates

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="$SCRIPT_DIR/data/certs"
CONFIG_FILE="$SCRIPT_DIR/data/config.json"

echo "🔐 WaterRower Training System - SSL Certificate Setup"
echo "======================================================"
echo ""

# Create certificate directory if it doesn't exist
mkdir -p "$CERT_DIR"

show_menu() {
    echo "Please select an option:"
    echo "1) Generate self-signed certificate (for testing/local use)"
    echo "2) Setup Let's Encrypt certificate (requires domain and certbot)"
    echo "3) Use existing certificates (specify paths)"
    echo "4) Disable HTTPS"
    echo "5) Exit"
    echo ""
    read -p "Enter option (1-5): " option
}

generate_self_signed() {
    echo ""
    echo "📝 Generating self-signed certificate..."
    echo ""
    
    read -p "Enter domain/hostname (e.g., localhost, waterrower.local): " domain
    domain=${domain:-localhost}
    
    # Generate private key and certificate
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERT_DIR/privkey.pem" \
        -out "$CERT_DIR/fullchain.pem" \
        -subj "/CN=$domain/O=WaterRower Training/C=US"
    
    chmod 600 "$CERT_DIR/privkey.pem"
    chmod 644 "$CERT_DIR/fullchain.pem"
    
    echo ""
    echo "✅ Self-signed certificate generated!"
    echo "⚠️  Note: Browsers will show security warnings for self-signed certificates."
    echo ""
    
    enable_ssl_in_config
}

setup_letsencrypt() {
    echo ""
    echo "🌐 Let's Encrypt Certificate Setup"
    echo ""
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        echo "❌ Certbot is not installed."
        echo ""
        echo "To install certbot, run one of the following:"
        echo "  Ubuntu/Debian: sudo apt-get install certbot"
        echo "  Fedora: sudo dnf install certbot"
        echo "  macOS: brew install certbot"
        echo ""
        read -p "Press Enter to return to menu..."
        return
    fi
    
    read -p "Enter your domain name (e.g., waterrower.example.com): " domain
    read -p "Enter your email address: " email
    
    if [ -z "$domain" ] || [ -z "$email" ]; then
        echo "❌ Domain and email are required!"
        return
    fi
    
    echo ""
    echo "🔄 Requesting certificate from Let's Encrypt..."
    echo ""
    echo "⚠️  Important: This requires:"
    echo "   - Your domain to point to this server's public IP"
    echo "   - Port 80 to be accessible from the internet"
    echo ""
    read -p "Continue? (y/n): " confirm
    
    if [ "$confirm" != "y" ]; then
        echo "Cancelled."
        return
    fi
    
    # Request certificate using standalone mode
    sudo certbot certonly --standalone \
        --preferred-challenges http \
        --email "$email" \
        --agree-tos \
        --no-eff-email \
        -d "$domain"
    
    if [ $? -eq 0 ]; then
        # Copy certificates to our cert directory
        sudo cp "/etc/letsencrypt/live/$domain/privkey.pem" "$CERT_DIR/"
        sudo cp "/etc/letsencrypt/live/$domain/fullchain.pem" "$CERT_DIR/"
        sudo chown $USER:$USER "$CERT_DIR/privkey.pem" "$CERT_DIR/fullchain.pem"
        chmod 600 "$CERT_DIR/privkey.pem"
        chmod 644 "$CERT_DIR/fullchain.pem"
        
        echo ""
        echo "✅ Let's Encrypt certificate installed!"
        echo ""
        echo "📅 Certificate renewal:"
        echo "   Certificates expire in 90 days. Set up auto-renewal with:"
        echo "   sudo certbot renew --deploy-hook 'cp /etc/letsencrypt/live/$domain/*.pem $CERT_DIR/ && chown $USER:$USER $CERT_DIR/*.pem'"
        echo ""
        echo "   Or add to crontab:"
        echo "   0 0 * * * certbot renew --quiet --deploy-hook 'cp /etc/letsencrypt/live/$domain/*.pem $CERT_DIR/ && chown $USER:$USER $CERT_DIR/*.pem'"
        echo ""
        
        enable_ssl_in_config
    else
        echo "❌ Failed to obtain certificate from Let's Encrypt"
    fi
}

use_existing_certs() {
    echo ""
    echo "📁 Use Existing Certificates"
    echo ""
    
    read -p "Enter path to private key (privkey.pem): " key_path
    read -p "Enter path to certificate (fullchain.pem): " cert_path
    
    if [ ! -f "$key_path" ]; then
        echo "❌ Private key file not found: $key_path"
        return
    fi
    
    if [ ! -f "$cert_path" ]; then
        echo "❌ Certificate file not found: $cert_path"
        return
    fi
    
    # Copy certificates to cert directory
    cp "$key_path" "$CERT_DIR/privkey.pem"
    cp "$cert_path" "$CERT_DIR/fullchain.pem"
    chmod 600 "$CERT_DIR/privkey.pem"
    chmod 644 "$CERT_DIR/fullchain.pem"
    
    echo ""
    echo "✅ Certificates copied successfully!"
    echo ""
    
    enable_ssl_in_config
}

enable_ssl_in_config() {
    read -p "Enter HTTPS port (default: 3443): " https_port
    https_port=${https_port:-3443}
    
    # Update config.json to enable SSL
    if [ -f "$CONFIG_FILE" ]; then
        # Use node to update JSON (if available) or create new config
        cat > "$CONFIG_FILE.tmp" <<EOF
{
  "port": 3000,
  "fitFilesDirectory": "./data/fit-files",
  "ssl": {
    "enabled": true,
    "keyPath": "./data/certs/privkey.pem",
    "certPath": "./data/certs/fullchain.pem",
    "port": $https_port
  }
}
EOF
        mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
    else
        mkdir -p "$(dirname "$CONFIG_FILE")"
        cat > "$CONFIG_FILE" <<EOF
{
  "port": 3000,
  "fitFilesDirectory": "./data/fit-files",
  "ssl": {
    "enabled": true,
    "keyPath": "./data/certs/privkey.pem",
    "certPath": "./data/certs/fullchain.pem",
    "port": $https_port
  }
}
EOF
    fi
    
    echo ""
    echo "✅ SSL/HTTPS enabled in configuration!"
    echo ""
    echo "🚀 Restart the WaterRower Training System to apply changes."
    echo "   Access your application at: https://localhost:$https_port"
    echo ""
}

disable_ssl() {
    echo ""
    echo "Disabling HTTPS..."
    
    if [ -f "$CONFIG_FILE" ]; then
        cat > "$CONFIG_FILE.tmp" <<EOF
{
  "port": 3000,
  "fitFilesDirectory": "./data/fit-files",
  "ssl": {
    "enabled": false,
    "keyPath": "./data/certs/privkey.pem",
    "certPath": "./data/certs/fullchain.pem",
    "port": 3443
  }
}
EOF
        mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
    fi
    
    echo ""
    echo "✅ HTTPS disabled. Application will run on HTTP only."
    echo ""
}

# Main menu loop
while true; do
    show_menu
    
    case $option in
        1)
            generate_self_signed
            ;;
        2)
            setup_letsencrypt
            ;;
        3)
            use_existing_certs
            ;;
        4)
            disable_ssl
            ;;
        5)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo "Invalid option. Please try again."
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    clear
done
