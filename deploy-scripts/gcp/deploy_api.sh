#!/usr/bin/env bash
# Deploy API server only
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export DEPLOY_WEB=0
export DEPLOY_ADMIN=0
export DEPLOY_SERVER=1

exec "${SCRIPT_DIR}/deploy.sh" "$@"
