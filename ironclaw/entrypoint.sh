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

# Persistent binary path — on the Docker volume so it survives container recreation
IRONCLAW_BIN="/home/ironclaw/.ironclaw/bin/ironclaw"

if [ -f "$UPDATE_BIN" ]; then
  echo "[entrypoint] Found updated binary at ${UPDATE_BIN}"
  mkdir -p /home/ironclaw/.ironclaw/bin
  cp "$UPDATE_BIN" "$IRONCLAW_BIN"
  chmod +x "$IRONCLAW_BIN"
  rm -f "$UPDATE_BIN"

  # Update version tracking
  if [ -f "$UPDATE_VER" ]; then
    cp "$UPDATE_VER" /home/ironclaw/.ironclaw/bin/version
    rm -f "$UPDATE_VER"
  fi

  echo "[entrypoint] Binary updated — will use ${IRONCLAW_BIN}"
elif [ -f "$IRONCLAW_BIN" ]; then
  # Previously updated binary exists on persistent volume — use it
  echo "[entrypoint] Using persistent binary at ${IRONCLAW_BIN}"
else
  # No update staged and no persistent binary — use system binary from image
  IRONCLAW_BIN="ironclaw"
fi

# Export version: persistent volume version takes priority over build-time
if [ -f /home/ironclaw/.ironclaw/bin/version ]; then
  export IRONCLAW_VERSION="$(cat /home/ironclaw/.ironclaw/bin/version)"
elif [ -f /tmp/ironclaw-version ]; then
  export IRONCLAW_VERSION="$(cat /tmp/ironclaw-version)"
fi
# Share with backend via shared volume
echo "${IRONCLAW_VERSION:-unknown}" > /shared/tokens/ironclaw-version 2>/dev/null || true

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
# Wait for MCP server to be reachable before configuring.
# Prevents race condition where Ironclaw starts before bastion-mcp is ready.
# ---------------------------------------------------------------------------
echo "[entrypoint] Waiting for MCP server at localhost:${MCP_LOCAL_PORT}..."
MCP_RETRIES=0
MCP_MAX_RETRIES=30
while [ "$MCP_RETRIES" -lt "$MCP_MAX_RETRIES" ]; do
  if curl -sf "http://localhost:${MCP_LOCAL_PORT}/health" >/dev/null 2>&1; then
    echo "[entrypoint] MCP server is ready"
    break
  fi
  MCP_RETRIES=$((MCP_RETRIES + 1))
  sleep 2
done
if [ "$MCP_RETRIES" -eq "$MCP_MAX_RETRIES" ]; then
  echo "[entrypoint] WARNING: MCP server not reachable after ${MCP_MAX_RETRIES} attempts — starting anyway"
fi

# ---------------------------------------------------------------------------
# Configure Ironclaw via CLI before starting the agent.
# These settings persist in the database across restarts.
# ---------------------------------------------------------------------------
configure_ironclaw() {
  CONFIG_FILE="/home/ironclaw/.ironclaw/config.toml"

  # ---------------------------------------------------------------------------
  # Write config.toml directly — this is the authoritative config file.
  # `ironclaw config set` writes to the DB which is LOWER priority than
  # config.toml, so those values get silently overridden. Writing the file
  # ensures status, runtime, and heartbeat all see the same values.
  # ---------------------------------------------------------------------------
  cat > "$CONFIG_FILE" <<TOML
# IronClaw configuration — managed by entrypoint.sh
# Priority: env var > this file > database settings > defaults.

onboard_completed = true
secrets_master_key_source = "env"

[embeddings]
enabled = true
provider = "nearai"
model = "text-embedding-3-small"

[tunnel]
ts_funnel = false

[channels]
http_enabled = true
http_port = 8080
http_host = "0.0.0.0"
signal_enabled = false
wasm_channels = []
wasm_channels_enabled = false

[channels.wasm_channel_owner_ids]

[heartbeat]
enabled = true
interval_secs = 1800

[agent]
name = "ironclaw"
max_parallel_jobs = 5
job_timeout_secs = 3600
stuck_threshold_secs = 300
use_planning = true
repair_check_interval_secs = 60
max_repair_attempts = 3
session_idle_timeout_secs = 604800
max_tool_iterations = 50
auto_approve_tools = false

[wasm]
enabled = true
default_memory_limit = 10485760
default_timeout_secs = 60
default_fuel_limit = 10000000
cache_compiled = true

[sandbox]
enabled = false
policy = "readonly"
timeout_secs = 120
memory_limit_mb = 2048
cpu_shares = 1024
image = "ironclaw-worker:latest"
auto_pull_image = true
extra_allowed_domains = []

[safety]
max_output_length = 100000
injection_check_enabled = true

[builder]
enabled = true
max_iterations = 20
timeout_secs = 600
auto_register = true
TOML

  echo "[entrypoint] Config written: heartbeat=true, embeddings=nearai, sandbox=false, secrets=env"

  # WASM tools directory — create if missing
  mkdir -p /home/ironclaw/.ironclaw/tools 2>/dev/null

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
