#!/bin/sh
# Ironclaw Token-Sync Entrypoint
#
# Reads the Anthropic OAuth token from a shared volume file (written by the
# BASTION backend on each token refresh) and exports it before starting
# Ironclaw. A background watcher restarts Ironclaw when the token file
# changes, so the sidecar always uses a valid token without manual
# container restarts.
#
# Token priority: shared file > env var ANTHROPIC_OAUTH_TOKEN > ANTHROPIC_API_KEY

TOKEN_FILE="/shared/tokens/anthropic-oauth-token"
CHECK_INTERVAL=60  # seconds between token file checks

load_token() {
  if [ -f "$TOKEN_FILE" ]; then
    NEW_TOKEN=$(cat "$TOKEN_FILE" 2>/dev/null)
    if [ -n "$NEW_TOKEN" ]; then
      export ANTHROPIC_OAUTH_TOKEN="$NEW_TOKEN"
    fi
  fi
}

# Initial token load
load_token

echo "[entrypoint] Starting Ironclaw (token source: ${TOKEN_FILE})"

# Start ironclaw in the background.
# 'sleep infinity' keeps stdin open so the repl channel doesn't EOF-shutdown.
sleep infinity | ironclaw run --no-onboard &
IRONCLAW_PID=$!

# Store initial token fingerprint (last 8 chars) for change detection
LAST_FINGERPRINT=""
if [ -f "$TOKEN_FILE" ]; then
  LAST_FINGERPRINT=$(tail -c 8 "$TOKEN_FILE" 2>/dev/null)
fi

# Background watcher: poll the token file for changes
while true; do
  sleep "$CHECK_INTERVAL"

  if [ ! -f "$TOKEN_FILE" ]; then
    continue
  fi

  CURRENT_FINGERPRINT=$(tail -c 8 "$TOKEN_FILE" 2>/dev/null)

  if [ "$CURRENT_FINGERPRINT" != "$LAST_FINGERPRINT" ] && [ -n "$CURRENT_FINGERPRINT" ]; then
    echo "[entrypoint] Token file changed — restarting Ironclaw with new token"
    LAST_FINGERPRINT="$CURRENT_FINGERPRINT"

    # Reload token
    load_token

    # Gracefully stop current instance
    kill "$IRONCLAW_PID" 2>/dev/null
    wait "$IRONCLAW_PID" 2>/dev/null

    # Restart
    sleep infinity | ironclaw run --no-onboard &
    IRONCLAW_PID=$!
    echo "[entrypoint] Ironclaw restarted with refreshed token"
  fi
done
