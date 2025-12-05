# SSL/HTTPS Setup Guide

This guide explains how to enable HTTPS for your WaterRower Training System with SSL/TLS certificates.

## Quick Start

Run the SSL setup script:

```bash
./setup-ssl.sh
```

The script provides three options for certificate setup:

1. **Self-signed certificate** (for testing/local use)
2. **Let's Encrypt certificate** (for production with a domain)
3. **Use existing certificates** (if you already have certificates)

## Option 1: Self-Signed Certificate (Local/Testing)

Best for: Local development, testing, or home network use.

```bash
./setup-ssl.sh
# Select option 1
```

**Note:** Browsers will show security warnings for self-signed certificates. This is normal and safe for local use.

To bypass the warning:
- Chrome/Edge: Click "Advanced" → "Proceed to localhost"
- Firefox: Click "Advanced" → "Accept the Risk and Continue"

## Option 2: Let's Encrypt (Production)

Best for: Public-facing servers with a domain name.

### Prerequisites:
- A registered domain name pointing to your server
- Port 80 open and accessible from the internet
- `certbot` installed on your system

### Install Certbot:

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install certbot
```

**Fedora:**
```bash
sudo dnf install certbot
```

**macOS:**
```bash
brew install certbot
```

### Setup:
```bash
./setup-ssl.sh
# Select option 2
# Enter your domain name (e.g., waterrower.example.com)
# Enter your email address
```

### Certificate Renewal

Let's Encrypt certificates expire after 90 days. Set up automatic renewal:

#### Method 1: Systemd Timer (Ubuntu/Debian)
```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

#### Method 2: Crontab
Add this line to your crontab (`sudo crontab -e`):
```bash
0 0 * * * certbot renew --quiet --deploy-hook 'cp /etc/letsencrypt/live/YOUR_DOMAIN/*.pem /root/waterrower_ble/data/certs/ && chown $USER:$USER /root/waterrower_ble/data/certs/*.pem && systemctl restart waterrower'
```

Replace `YOUR_DOMAIN` with your actual domain name.

#### Method 3: Manual Renewal
```bash
sudo certbot renew
sudo cp /etc/letsencrypt/live/YOUR_DOMAIN/*.pem /root/waterrower_ble/data/certs/
sudo chown $USER:$USER /root/waterrower_ble/data/certs/*.pem
# Restart the application
```

## Option 3: Existing Certificates

If you already have SSL certificates from another source:

```bash
./setup-ssl.sh
# Select option 3
# Enter path to your private key file
# Enter path to your certificate file
```

## Configuration

After setup, your configuration file (`data/config.json`) will include:

```json
{
  "port": 3000,
  "ssl": {
    "enabled": true,
    "keyPath": "./data/certs/privkey.pem",
    "certPath": "./data/certs/fullchain.pem",
    "port": 3443
  }
}
```

### Configuration Options:

- `enabled`: Set to `true` to enable HTTPS, `false` to disable
- `keyPath`: Path to your private key file
- `certPath`: Path to your certificate file
- `port`: HTTPS port (default: 3443)

## Accessing Your Application

After enabling HTTPS:

- **HTTP:** http://localhost:3000
- **HTTPS:** https://localhost:3443

Both HTTP and HTTPS will run simultaneously. The application remains accessible via HTTP even when HTTPS is enabled.

## Troubleshooting

### Certificate Not Found Error

If you see "Failed to create HTTPS server" in logs:
1. Verify certificates exist: `ls -la data/certs/`
2. Check file permissions: `chmod 600 data/certs/privkey.pem && chmod 644 data/certs/fullchain.pem`
3. Verify certificate paths in `data/config.json`

### Port Already in Use

If port 3443 is already in use:
1. Edit `data/config.json`
2. Change `ssl.port` to another port (e.g., 8443)
3. Restart the application

### Browser Security Warnings (Self-Signed)

This is expected behavior for self-signed certificates. To avoid warnings:
1. Use Let's Encrypt for production
2. Import the self-signed certificate into your browser's trusted certificates

### Let's Encrypt Verification Failed

Common issues:
- Domain doesn't point to your server → Update DNS records
- Port 80 not accessible → Check firewall rules
- Another service using port 80 → Stop other web servers temporarily

## Disabling HTTPS

To disable HTTPS and use HTTP only:

```bash
./setup-ssl.sh
# Select option 4
```

Or manually edit `data/config.json`:
```json
{
  "ssl": {
    "enabled": false
  }
}
```

## Security Best Practices

1. **Use Let's Encrypt for production** - Free, trusted, and automated
2. **Keep certificates private** - Never commit certificates to version control
3. **Regularly update certificates** - Set up automatic renewal
4. **Use strong ciphers** - The application uses modern TLS defaults
5. **Monitor expiration** - Certificates expire, plan for renewal

## Systemd Service with Auto-Renewal

To automatically restart the service after certificate renewal, create a systemd service:

```bash
sudo nano /etc/systemd/system/waterrower.service
```

Add:
```ini
[Unit]
Description=WaterRower Training System
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/root/waterrower_ble
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable waterrower
sudo systemctl start waterrower
```

## Support

For issues or questions:
- Check application logs for SSL-related errors
- Verify certificate files exist and have correct permissions
- Ensure your firewall allows the HTTPS port
- Test with `curl -k https://localhost:3443` (bypasses certificate verification)
