#!/usr/bin/env bash
# Deploy web only
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export DEPLOY_WEB=1
export DEPLOY_ADMIN=0
export DEPLOY_SERVER=0

exec "${SCRIPT_DIR}/deploy.sh" "$@"
