#!/bin/bash
# Deploy BASTION docs to bastion.vitalpoint.ai server
#
# Usage: ./scripts/deploy.sh
#
# Prerequisites:
#   - SSH key at ~/.ssh/bastion-hetzner
#   - Node.js 18+ with npm
#   - nginx configured on server (see nginx.conf in this directory)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SITE_DIR="$SCRIPT_DIR/.."
SSH_KEY="$HOME/.ssh/bastion-hetzner"
REMOTE_USER="deploy"
REMOTE_HOST="bastion.vitalpoint.ai"
REMOTE_PATH="/var/www/docs.bastion.vitalpoint.ai"

echo "=== BASTION Docs Deployment ==="

# Build
echo "Building docs site..."
cd "$SITE_DIR"
npm ci --production=false
npm run build

# Deploy
echo "Deploying to $REMOTE_HOST..."
rsync -avz --delete \
  -e "ssh -i $SSH_KEY" \
  "$SITE_DIR/build/" \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

echo "Deployment complete!"
echo "Site available at: https://docs.bastion.vitalpoint.ai"
