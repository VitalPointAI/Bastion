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
# Register built-in routines via CLI (creates full_job routines with tool
# access). These persist in the DB — idempotent on re-runs since CLI
# rejects duplicate names with a non-fatal error.
# ---------------------------------------------------------------------------
register_routines() {
  echo "[entrypoint] Registering built-in routines..."

  $IRONCLAW_BIN routines create \
    --name "autonomous_monitoring" \
    --schedule "0 */30 * * * *" \
    --description "Autonomous operational monitoring: conflict detection, gap research, PIR checking, situation assessment" \
    --prompt "Run autonomous operational monitoring. Check active problem sets for: (1) contradictions or conflicts in the knowledge graph, (2) intelligence gaps that need research, (3) PIR/IR that may have been answered by new data, (4) changes in situation that warrant a draft assessment. Use bastion tools to query current state. Log any findings as autonomous activity entries using bastion.ironclaw.log_activity." \
    2>/dev/null && echo "[entrypoint] Registered: autonomous_monitoring" || echo "[entrypoint] autonomous_monitoring already exists or failed"

  $IRONCLAW_BIN routines create \
    --name "bastion_knowledge_sync" \
    --schedule "0 0 */6 * * *" \
    --description "Sync shared workspace data — problem sets, operations, tools, agent team" \
    --prompt "Review the current BASTION_CONTEXT.md in your workspace. Use the bastion.problem_set.list tool to check for any new or updated operations. Report any changes you notice." \
    2>/dev/null && echo "[entrypoint] Registered: bastion_knowledge_sync" || echo "[entrypoint] bastion_knowledge_sync already exists or failed"

  $IRONCLAW_BIN routines create \
    --name "daily_situation_brief" \
    --schedule "0 0 6 * * *" \
    --description "Generate morning situation brief — overnight intel, pending decisions, priority actions" \
    --prompt "Generate a morning situation brief. Check active problem sets for: (1) new intelligence or OSINT events since last brief, (2) pending decisions requiring commander attention, (3) priority actions for today. Format as a concise SITREP." \
    2>/dev/null && echo "[entrypoint] Registered: daily_situation_brief" || echo "[entrypoint] daily_situation_brief already exists or failed"

  $IRONCLAW_BIN routines create \
    --name "weekly_capability_update" \
    --schedule "0 0 9 * * 1" \
    --description "Weekly review of available BASTION tools, agents, and system changes" \
    --prompt "Review the available BASTION tools and agents. List any new capabilities, updated tools, or system changes since last check. Summarize in a brief capability report." \
    2>/dev/null && echo "[entrypoint] Registered: weekly_capability_update" || echo "[entrypoint] weekly_capability_update already exists or failed"

  echo "[entrypoint] Routine registration complete"
}

register_routines

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
