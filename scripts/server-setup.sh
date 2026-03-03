#!/usr/bin/env bash
set -euo pipefail

# ============================================
# Bastion Server Setup - Idempotent Bootstrap
# Run as root on a fresh Ubuntu 24.04 server (Hetzner CX33)
# Usage: bash server-setup.sh <domain> <ssh-public-key>
#
# Safe to re-run — each step checks if it's already done.
#
# This script:
#   1. Creates a non-root 'deploy' user with Docker access
#   2. Installs Docker (CE + Compose plugin)
#   3. Installs nginx and certbot for TLS
#   4. Configures UFW firewall (22, 80, 443 only)
#   5. Creates application directory
#   6. Clones the Bastion repository
#   7. Installs host nginx config with domain substitution
#   8. Obtains Let's Encrypt TLS certificate
#   9. Hardens SSH (disables root login)
#  10. Creates .env.prod template for secrets
# ============================================

DOMAIN="${1:?Usage: server-setup.sh <domain> <ssh-public-key>}"
SSH_PUB_KEY="${2:?Usage: server-setup.sh <domain> <ssh-public-key>}"

echo "=== Setting up Bastion server for $DOMAIN ==="

# 1. Create deploy user with Docker group
echo "--- Creating deploy user ---"
if id deploy &>/dev/null; then
  echo "User 'deploy' already exists, skipping creation"
else
  useradd -m -s /bin/bash -G sudo deploy
fi
mkdir -p /home/deploy/.ssh
echo "$SSH_PUB_KEY" > /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy

# 2. Install Docker
echo "--- Installing Docker ---"
if command -v docker &>/dev/null; then
  echo "Docker already installed, skipping"
else
  apt-get update
  apt-get install -y apt-transport-https ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
usermod -aG docker deploy

# 3. Install nginx and certbot
echo "--- Installing nginx and certbot ---"
apt-get install -y nginx certbot python3-certbot-nginx

# 4. Configure UFW firewall
echo "--- Configuring UFW firewall ---"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 5. Create application directory
echo "--- Creating application directory ---"
mkdir -p /home/deploy/bastion
chown deploy:deploy /home/deploy/bastion

# 6. Clone repository (for docker-compose.prod.yml and database init files)
# Requires deploy key at /home/deploy/.ssh/bastion-deploy (copy before running this step)
echo "--- Cloning Bastion repository ---"
cat > /home/deploy/.ssh/config << 'SSHEOF'
Host github.com
  IdentityFile ~/.ssh/bastion-deploy
  StrictHostKeyChecking accept-new
SSHEOF
chmod 600 /home/deploy/.ssh/config
chown deploy:deploy /home/deploy/.ssh/config
if [ -d /home/deploy/bastion/.git ]; then
  echo "Repository already cloned, pulling latest"
  su - deploy -c "cd /home/deploy/bastion && git pull origin master"
else
  su - deploy -c "git clone git@github.com:VitalPointAI/Bastion.git /home/deploy/bastion"
fi

# 7. Install HTTP-only nginx config first (certbot needs this to serve ACME challenge)
echo "--- Installing nginx config for $DOMAIN ---"
rm -f /etc/nginx/sites-enabled/default
cat > /etc/nginx/sites-available/bastion << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINXEOF
ln -sf /etc/nginx/sites-available/bastion /etc/nginx/sites-enabled/bastion
mkdir -p /var/www/certbot
nginx -t
systemctl reload nginx

# 8. Obtain TLS certificate (certbot will modify the nginx config to add SSL)
echo "--- Obtaining TLS certificate for $DOMAIN ---"
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "TLS certificate already exists, skipping"
else
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN" --redirect
fi

# 9. Install full production nginx config (with SSL, SSE support, WebSocket upgrade)
echo "--- Installing production nginx config ---"
cp /home/deploy/bastion/nginx/nginx.prod.conf /etc/nginx/sites-available/bastion
sed -i "s/\${DOMAIN}/$DOMAIN/g" /etc/nginx/sites-available/bastion
nginx -t
systemctl reload nginx

# 10. Disable root SSH login
echo "--- Hardening SSH ---"
sed -i 's/#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl reload ssh

# 11. Create .env.prod template
echo "--- Creating .env.prod template ---"
if [ -f /home/deploy/bastion/.env.prod ]; then
  echo ".env.prod already exists, skipping (won't overwrite your secrets)"
else
  cat > /home/deploy/bastion/.env.prod << 'ENVEOF'
# Production environment - fill in all values before starting services
# This file is NOT committed to git — it lives only on the server
# Domain: bastion.vitalpoint.ai

# Database passwords
POSTGRES_PASSWORD=CHANGE_ME
NEO4J_PASSWORD=CHANGE_ME

# IPFS (Pinata) — backend uploads via server-side JWT
PINATA_JWT=CHANGE_ME
PINATA_GATEWAY=https://coffee-kind-eagle-207.mypinata.cloud

# AI providers (at least one required for strategic extraction)
ANTHROPIC_API_KEY=CHANGE_ME
# OPENAI_API_KEY=
# NEAR_AI_API_KEY=

# Encryption keys
# Generate each with: openssl rand -hex 32
ENCRYPTION_KEY=CHANGE_ME
CONFIG_ENCRYPTION_KEY=CHANGE_ME
TOTP_ENCRYPTION_KEY=CHANGE_ME

# Admin access control (comma-separated DIDs)
ADMIN_DIDS=CHANGE_ME

# NEAR blockchain
NEAR_NETWORK_ID=testnet
NEAR_RPC_URL=https://rpc.testnet.fastnear.com
# NEAR_BACKEND_ACCOUNT_ID=
# NEAR_BACKEND_PRIVATE_KEY=
# NEAR_FUNDING_CONTRACT_ID=
# NEAR_FUNDING_ACCOUNT_ID=
# NEAR_FUNDING_PRIVATE_KEY=

# Passkey / WebAuthn
RP_ID=bastion.vitalpoint.ai
RP_NAME=BASTION
ORIGIN=https://bastion.vitalpoint.ai

# Email (AWS SES) — optional
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=us-east-1
# FROM_EMAIL=noreply@bastion.vitalpoint.ai
APP_URL=https://bastion.vitalpoint.ai
ENVEOF
  chown deploy:deploy /home/deploy/bastion/.env.prod
  chmod 600 /home/deploy/bastion/.env.prod
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "1. Edit /home/deploy/bastion/.env.prod with real passwords"
echo "   sudo -u deploy nano /home/deploy/bastion/.env.prod"
echo ""
echo "2. Log in as deploy user: ssh deploy@$DOMAIN"
echo ""
echo "3. GitHub Actions will handle all future deployments from here"
echo "   (Add HETZNER_HOST, HETZNER_USER, HETZNER_SSH_KEY to GitHub Secrets)"
