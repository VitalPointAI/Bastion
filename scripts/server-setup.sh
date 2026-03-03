#!/usr/bin/env bash
set -euo pipefail

# ============================================
# Bastion Server Setup - One-Time Bootstrap
# Run as root on a fresh Ubuntu 24.04 server (Hetzner CAX21/CAX31)
# Usage: bash server-setup.sh <domain> <ssh-public-key>
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
useradd -m -s /bin/bash -G sudo deploy
mkdir -p /home/deploy/.ssh
echo "$SSH_PUB_KEY" > /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy

# 2. Install Docker
echo "--- Installing Docker ---"
apt-get update
apt-get install -y apt-transport-https ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
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
echo "--- Cloning Bastion repository ---"
su - deploy -c "git clone https://github.com/VitalPointAI/Bastion.git /home/deploy/bastion"

# 7. Install host nginx config
echo "--- Installing nginx config for $DOMAIN ---"
cp /home/deploy/bastion/nginx/nginx.prod.conf /etc/nginx/sites-available/bastion
sed -i "s/\${DOMAIN}/$DOMAIN/g" /etc/nginx/sites-available/bastion
ln -sf /etc/nginx/sites-available/bastion /etc/nginx/sites-enabled/bastion
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# 8. Obtain TLS certificate
echo "--- Obtaining TLS certificate for $DOMAIN ---"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN" --redirect

# 9. Disable root SSH login
echo "--- Hardening SSH ---"
sed -i 's/#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl reload sshd

# 10. Create .env.prod template
echo "--- Creating .env.prod template ---"
cat > /home/deploy/bastion/.env.prod << 'ENVEOF'
# Production environment - fill in all values before starting services
# This file is NOT committed to git — it lives only on the server

# Database passwords
POSTGRES_PASSWORD=CHANGE_ME
NEO4J_PASSWORD=CHANGE_ME

# Add other secrets that the backend needs at runtime
# (NEAR keys, AI API keys, etc. — same variables as backend/.env in development)
ENVEOF
chown deploy:deploy /home/deploy/bastion/.env.prod
chmod 600 /home/deploy/bastion/.env.prod

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
