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
# Extract host:port from MCP URL for the local proxy
MCP_HOST_PORT=$(echo "$MCP_URL" | sed -E 's|https?://([^/]+).*|\1|')
MCP_LOCAL_PORT=$(echo "$MCP_HOST_PORT" | sed -E 's/.*:([0-9]+)/\1/')

# ---------------------------------------------------------------------------
# Local proxy: Ironclaw requires HTTPS for remote MCP servers but allows
# localhost. Run socat to forward localhost:MCP_PORT -> bastion-mcp:MCP_PORT
# so we can register MCP via http://localhost:<port>/mcp.
# ---------------------------------------------------------------------------
start_mcp_proxy() {
  # Kill any existing proxy
  kill "$SOCAT_PID" 2>/dev/null
  wait "$SOCAT_PID" 2>/dev/null

  socat TCP-LISTEN:"${MCP_LOCAL_PORT}",fork,reuseaddr,bind=127.0.0.1 \
    TCP:"${MCP_HOST_PORT}" &
  SOCAT_PID=$!
  echo "[entrypoint] MCP proxy: localhost:${MCP_LOCAL_PORT} → ${MCP_HOST_PORT} (pid ${SOCAT_PID})"
}

start_mcp_proxy

# ---------------------------------------------------------------------------
# Configure Ironclaw via CLI before starting the agent.
# These settings persist in the database across restarts.
# ---------------------------------------------------------------------------
configure_ironclaw() {
  # Disable sandbox (no Docker-in-Docker available)
  $IRONCLAW_BIN config set sandbox.enabled false 2>/dev/null

  # Enable heartbeat for autonomous monitoring
  $IRONCLAW_BIN config set heartbeat.enabled true 2>/dev/null
  $IRONCLAW_BIN config set heartbeat.interval_secs 1800 2>/dev/null

  # Secrets keychain — enable if master key is provided
  if [ -n "${IRONCLAW_SECRETS_MASTER_KEY:-}" ]; then
    $IRONCLAW_BIN config set secrets_master_key_source env 2>/dev/null
    echo "[entrypoint] Secrets keychain enabled (master key from env)"
  else
    echo "[entrypoint] WARNING: No IRONCLAW_SECRETS_MASTER_KEY — secrets keychain disabled"
  fi

  # Embeddings — NEAR AI provider (no API key needed)
  $IRONCLAW_BIN config set embeddings.enabled true 2>/dev/null
  $IRONCLAW_BIN config set embeddings.provider nearai 2>/dev/null
  $IRONCLAW_BIN config set embeddings.model text-embedding-3-small 2>/dev/null
  echo "[entrypoint] Embeddings enabled (NEAR AI text-embedding-3-small)"

  # WASM tools directory — create if missing
  mkdir -p /home/ironclaw/.ironclaw/tools 2>/dev/null
  echo "[entrypoint] WASM tools directory ready"

  # Register BASTION MCP server via localhost proxy
  # Remove first in case URL changed, ignore errors if not present
  $IRONCLAW_BIN mcp remove bastion-core 2>/dev/null || true
  $IRONCLAW_BIN mcp add bastion-core "http://localhost:${MCP_LOCAL_PORT}/mcp" 2>&1
  if [ $? -eq 0 ]; then
    echo "[entrypoint] MCP server registered: bastion-core → localhost:${MCP_LOCAL_PORT} → ${MCP_HOST_PORT}"
  else
    echo "[entrypoint] WARNING: MCP registration failed"
  fi
}

configure_ironclaw

# ---------------------------------------------------------------------------
# Routine registration is handled by the BASTION backend via direct DB writes
# to Ironclaw's routines table (routine-service.ts). This ensures routines are
# created as full_job with proper action_config (tools_enabled, max_tool_rounds).
# CLI registration was removed in v0.24 upgrade because:
#   1. CLI defaults to lightweight action_type (no MCP tool access)
#   2. Backend registers per-problem-set routines with correct config
#   3. Duplicate routines caused confusion in routine state tracking
# ---------------------------------------------------------------------------
echo "[entrypoint] Routines managed by BASTION backend (skipping CLI registration)"

# ---------------------------------------------------------------------------
# Start the agent
# ---------------------------------------------------------------------------
$IRONCLAW_BIN run --no-onboard &
IRONCLAW_PID=$!
echo "[entrypoint] Ironclaw agent started (pid ${IRONCLAW_PID})"

# Give agent time to initialize before verifying
sleep 5

# Verify MCP tools were discovered
$IRONCLAW_BIN mcp list 2>&1
$IRONCLAW_BIN status 2>&1

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

    # Restart agent
    $IRONCLAW_BIN run --no-onboard &
    IRONCLAW_PID=$!
    echo "[entrypoint] Ironclaw restarted with refreshed token (pid ${IRONCLAW_PID})"
  fi

  # Check if ironclaw is still running
  if ! kill -0 "$IRONCLAW_PID" 2>/dev/null; then
    echo "[entrypoint] Ironclaw process died — restarting"
    $IRONCLAW_BIN run --no-onboard &
    IRONCLAW_PID=$!
    echo "[entrypoint] Ironclaw restarted (pid ${IRONCLAW_PID})"
  fi

  # Check if socat proxy is still running
  if ! kill -0 "$SOCAT_PID" 2>/dev/null; then
    echo "[entrypoint] MCP proxy died — restarting"
    start_mcp_proxy
  fi
done
