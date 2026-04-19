#!/usr/bin/env bash
# Wrapper for Virtual Protocol acp-cli (ACP 2.0). Repo: https://github.com/Virtual-Protocol/acp-cli
set -euo pipefail
ACP_ROOT="${ACP_CLI_ROOT:-/Users/test/acp-cli}"
cd "$ACP_ROOT"
exec npm run acp -- "$@"
