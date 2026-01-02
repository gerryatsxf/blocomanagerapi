# VPN Setup with WireGuard for Admin Panel Access

This guide covers setting up WireGuard VPN on your DigitalOcean droplet to secure access to admin endpoints and Swagger documentation.

## Overview

The following endpoints are now restricted to VPN IP addresses:
- `/admin/*` - All admin panel endpoints
- `/swagger` - API documentation
- `/swagger-json` - Swagger JSON specification

## Part 1: WireGuard Server Setup (DigitalOcean Droplet)

### 1. Install WireGuard on Ubuntu

SSH into your DigitalOcean droplet:

```bash
ssh root@your-droplet-ip
```

Update packages and install WireGuard:

```bash
apt update
apt install wireguard -y
```

### 2. Generate Server Keys

```bash
cd /etc/wireguard
umask 077
wg genkey | tee privatekey | wg pubkey > publickey
```

View the keys (save these somewhere secure):

```bash
cat privatekey  # Server private key
cat publickey   # Server public key
```

### 3. Configure WireGuard Server

Create the server configuration:

```bash
nano /etc/wireguard/wg0.conf
```

Add the following configuration (replace `YOUR_SERVER_PRIVATE_KEY` with your actual private key):

```ini
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = YOUR_SERVER_PRIVATE_KEY
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# Client 1 - Your Computer
[Peer]
PublicKey = CLIENT_1_PUBLIC_KEY_GOES_HERE
AllowedIPs = 10.0.0.2/32

# Client 2 - Another Device (optional)
[Peer]
PublicKey = CLIENT_2_PUBLIC_KEY_GOES_HERE
AllowedIPs = 10.0.0.3/32
```

**Important Notes:**
- `10.0.0.1/24` is the VPN subnet
- `10.0.0.2`, `10.0.0.3`, etc. are IPs for your client devices
- Replace `CLIENT_X_PUBLIC_KEY_GOES_HERE` with actual client public keys (generated in Part 2)

### 4. Enable IP Forwarding

```bash
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p
```

### 5. Configure Firewall

```bash
# Allow WireGuard port
ufw allow 51820/udp

# Allow SSH (important!)
ufw allow 22/tcp

# Allow your API port
ufw allow 3002/tcp

# Enable firewall
ufw enable
```

### 6. Start WireGuard

```bash
systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0
systemctl status wg-quick@wg0
```

Check the interface:

```bash
wg show
```

## Part 2: WireGuard Client Setup

### macOS Client Setup

1. **Install WireGuard:**
   ```bash
   brew install wireguard-tools
   ```

   Or download the [WireGuard app from App Store](https://apps.apple.com/us/app/wireguard/id1451685025)

2. **Generate Client Keys:**
   ```bash
   wg genkey | tee client_privatekey | wg pubkey > client_publickey
   cat client_privatekey  # Save this
   cat client_publickey   # Send this to add to server config
   ```

3. **Create Client Config:**
   
   Create file `~/blocomanager-vpn.conf`:

   ```ini
   [Interface]
   PrivateKey = YOUR_CLIENT_PRIVATE_KEY
   Address = 10.0.0.2/24
   DNS = 8.8.8.8

   [Peer]
   PublicKey = YOUR_SERVER_PUBLIC_KEY
   Endpoint = YOUR_DROPLET_IP:51820
   AllowedIPs = 10.0.0.0/24
   PersistentKeepalive = 25
   ```

   Replace:
   - `YOUR_CLIENT_PRIVATE_KEY` - from step 2
   - `YOUR_SERVER_PUBLIC_KEY` - from Part 1, step 2
   - `YOUR_DROPLET_IP` - your DigitalOcean droplet public IP

4. **Import to WireGuard App:**
   - Open WireGuard app
   - Click "Import tunnel(s) from file"
   - Select `blocomanager-vpn.conf`
   - Click "Activate"

### Windows Client Setup

1. Download and install [WireGuard for Windows](https://www.wireguard.com/install/)

2. Generate keys (PowerShell):
   ```powershell
   wg genkey | Out-File -Encoding ascii client_privatekey
   Get-Content client_privatekey | wg pubkey | Out-File -Encoding ascii client_publickey
   ```

3. Create the same config file as macOS (see above)

4. Import and activate in WireGuard GUI

### Linux Client Setup

1. **Install WireGuard:**
   ```bash
   sudo apt install wireguard -y
   ```

2. **Generate Keys:**
   ```bash
   wg genkey | tee client_privatekey | wg pubkey > client_publickey
   ```

3. **Create Config:**
   ```bash
   sudo nano /etc/wireguard/wg0.conf
   ```
   
   Use the same config as macOS (see above)

4. **Connect:**
   ```bash
   sudo wg-quick up wg0
   ```

## Part 3: Update Server with Client Public Keys

After generating client keys, add them to the server:

```bash
# On your droplet
nano /etc/wireguard/wg0.conf
```

Add a `[Peer]` section for each client (see Part 1, step 3), then restart:

```bash
systemctl restart wg-quick@wg0
```

## Part 4: Configure BlocoManager API

### 1. Update Environment Variables

Add your VPN client IPs to the configuration:

**Local Development (`env/dev.env`):**
```env
VPN_ALLOWED_IPS=10.0.0.2,10.0.0.3
```

**GitHub Actions (Repository Settings):**
1. Go to your repository → Settings → Secrets and variables → Actions → Variables
2. Add new variable:
   - Name: `VPN_ALLOWED_IPS`
   - Value: `10.0.0.2,10.0.0.3`

### 2. Restart API

```bash
# If running locally
npm run start:dev

# If running in Docker
docker compose restart

# On your droplet (Docker)
cd /path/to/blocomanagerapi
docker compose down
docker compose up -d
```

## Part 5: Testing

### 1. Connect to VPN

Activate your WireGuard connection on your device.

### 2. Verify VPN Connection

```bash
# Check your VPN IP
curl ifconfig.me

# Ping the VPN server
ping 10.0.0.1
```

### 3. Test Admin Access

**Should work (connected to VPN):**
```bash
curl http://your-droplet-ip:3002/swagger
```

**Should fail (disconnected from VPN):**
Disconnect from VPN and try again - you should get a 403 Forbidden response.

### 4. Check Logs

On your droplet:
```bash
# Check API logs
docker logs blocomanager-api

# Check WireGuard status
wg show

# Check connected peers
wg show wg0
```

## Troubleshooting

### Connection Issues

1. **Can't connect to VPN:**
   ```bash
   # Check server status
   systemctl status wg-quick@wg0
   
   # Check if port is open
   netstat -ulnp | grep 51820
   
   # Check firewall
   ufw status
   ```

2. **Connected but can't access admin:**
   ```bash
   # Check your VPN IP
   ifconfig wg0  # Should show 10.0.0.x
   
   # Check API logs for IP detection
   docker logs blocomanager-api | grep "Client IP"
   ```

3. **Admin works without VPN (development mode):**
   - This means `VPN_ALLOWED_IPS` is not set or empty
   - Check your environment variables
   - Restart the API after setting the variable

### Firewall Issues

If you lock yourself out:

```bash
# From DigitalOcean console (not SSH)
ufw disable
```

Then reconfigure carefully.

### DNS Issues

If you can't resolve domains while on VPN, update the client config:

```ini
[Interface]
DNS = 8.8.8.8, 8.8.4.4
```

## Security Best Practices

1. **Keep private keys secure** - Never commit them to git
2. **Use strong keys** - WireGuard's default key generation is secure
3. **Limit AllowedIPs** - Only route necessary traffic through VPN
4. **Monitor access** - Check WireGuard logs regularly
5. **Rotate keys** - Change keys if a device is compromised
6. **Backup configs** - Store server configs securely offsite

## Adding New Users

1. **Generate keys for new user:**
   ```bash
   wg genkey | tee new_user_privatekey | wg pubkey > new_user_publickey
   ```

2. **Add to server config:**
   ```bash
   nano /etc/wireguard/wg0.conf
   ```
   
   Add new `[Peer]` section with next available IP (e.g., 10.0.0.4)

3. **Restart server:**
   ```bash
   systemctl restart wg-quick@wg0
   ```

4. **Update API config:**
   ```env
   VPN_ALLOWED_IPS=10.0.0.2,10.0.0.3,10.0.0.4
   ```

5. **Send config to new user** - Give them the client config file

## Removing Users

1. **Remove from server config:**
   ```bash
   nano /etc/wireguard/wg0.conf
   # Delete the [Peer] section
   systemctl restart wg-quick@wg0
   ```

2. **Update API config:**
   ```env
   VPN_ALLOWED_IPS=10.0.0.2,10.0.0.3  # Remove the IP
   ```

## Development Mode

For local development without VPN:

```env
# Leave empty to allow all IPs
VPN_ALLOWED_IPS=
```

The guard will show a warning and allow access:
```
⚠️  VPN_ALLOWED_IPS not configured - allowing all IPs (DEVELOPMENT MODE)
```

## Production Checklist

Before deploying to production:

- [ ] WireGuard installed and configured on server
- [ ] Firewall rules configured (UFW)
- [ ] Client devices have WireGuard installed
- [ ] Client configs created and distributed securely
- [ ] `VPN_ALLOWED_IPS` set in GitHub Actions variables
- [ ] `VPN_ALLOWED_IPS` set in server environment
- [ ] API restarted with new environment variables
- [ ] Tested admin access with VPN connected
- [ ] Tested admin access blocked without VPN
- [ ] Swagger access tested and blocked without VPN
- [ ] WireGuard service set to start on boot

## Summary

You now have:
- ✅ Secure WireGuard VPN server on your droplet
- ✅ Client devices configured to connect
- ✅ Admin panel accessible only via VPN
- ✅ Swagger documentation restricted to VPN IPs
- ✅ IP whitelist guard protecting sensitive endpoints

All `/admin/*` and `/swagger*` routes now require connection to your WireGuard VPN!
