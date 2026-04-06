#!/usr/bin/env bash
set -euo pipefail
# Start the log monitor agent
# Requires: Docker socket access, ANTHROPIC_API_KEY, optionally GITHUB_TOKEN
cd "$(dirname "$0")/.."
exec node dist/log-monitor/index.js "$@"
