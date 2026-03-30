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

# ---------------------------------------------------------------------------
# Hot-update: if the backend placed a new binary in the shared volume,
# swap it in before starting. This allows the self-update service to
# download a new Ironclaw release and trigger a container restart.
# ---------------------------------------------------------------------------
UPDATE_BIN="/shared/tokens/ironclaw-update"
UPDATE_VER="/shared/tokens/ironclaw-update-version"

IRONCLAW_BIN="/home/ironclaw/bin/ironclaw"

if [ -f "$UPDATE_BIN" ]; then
  echo "[entrypoint] Found updated binary at ${UPDATE_BIN}"
  mkdir -p /home/ironclaw/bin
  cp "$UPDATE_BIN" "$IRONCLAW_BIN"
  chmod +x "$IRONCLAW_BIN"
  rm -f "$UPDATE_BIN"

  # Update version tracking
  if [ -f "$UPDATE_VER" ]; then
    cp "$UPDATE_VER" /tmp/ironclaw-version
    rm -f "$UPDATE_VER"
  fi

  echo "[entrypoint] Binary updated — will use ${IRONCLAW_BIN}"
elif [ ! -f "$IRONCLAW_BIN" ]; then
  # First run — no update staged, use system binary
  IRONCLAW_BIN="ironclaw"
fi

# Export version from build-time extraction and share with backend
if [ -f /tmp/ironclaw-version ]; then
  export IRONCLAW_VERSION="$(cat /tmp/ironclaw-version)"
  # Write to shared volume so backend can read it
  echo "$IRONCLAW_VERSION" > /shared/tokens/ironclaw-version 2>/dev/null || true
fi

echo "[entrypoint] Starting Ironclaw v${IRONCLAW_VERSION:-unknown} (token source: ${TOKEN_FILE})"

# MCP server URL (set by docker-compose, default for production)
MCP_URL="${MCP_BASTION_URL:-http://bastion-mcp:3334/mcp}"

# Start ironclaw with a FIFO so we can write commands to its REPL.
FIFO="/tmp/ironclaw-stdin"
rm -f "$FIFO"
mkfifo "$FIFO"

# Keep the FIFO open for writing by holding a background fd,
# then pipe reads from it into ironclaw's stdin.
(tail -f "$FIFO" 2>/dev/null) | $IRONCLAW_BIN run --no-onboard &
IRONCLAW_PID=$!

# Give ironclaw time to initialise its REPL before sending commands
sleep 5

# Register the BASTION MCP server so Ironclaw discovers all domain tools.
# This runs at every (re)start, ensuring tools survive token-triggered restarts.
echo "/mcp add bastion-core $MCP_URL" > "$FIFO"
echo "[entrypoint] Sent MCP registration: bastion-core → $MCP_URL"

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

    # Restart with FIFO for REPL commands
    rm -f "$FIFO"
    mkfifo "$FIFO"
    (tail -f "$FIFO" 2>/dev/null) | $IRONCLAW_BIN run --no-onboard &
    IRONCLAW_PID=$!
    echo "[entrypoint] Ironclaw restarted with refreshed token"

    # Re-register MCP tools after restart
    sleep 5
    echo "/mcp add bastion-core $MCP_URL" > "$FIFO"
    echo "[entrypoint] Re-registered MCP tools after restart"
  fi
done
