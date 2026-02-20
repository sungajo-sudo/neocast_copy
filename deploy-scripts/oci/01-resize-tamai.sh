#!/bin/bash
# =============================================================================
# NeoCAST - Resize tamai-dev A1 Instance
# 2 OCPU / 12GB -> 1 OCPU / 8GB (to free resources for neocast-dev)
#
# Always Free A1 total: 4 OCPU / 24GB
#   - tamai-dev:   1 OCPU /  8GB (after resize)
#   - neocast-dev: 3 OCPU / 16GB
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

# --- OCI CLI check ---
if ! command -v oci &> /dev/null; then
    log_error "OCI CLI is not installed. https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm"
    exit 1
fi

log_info "OCI CLI version: $(oci --version)"

# --- Resize tamai-dev instance ---
if [ -z "$TAMAI_INSTANCE_OCID" ]; then
    log_error "TAMAI_INSTANCE_OCID is not set in config.sh"
    exit 1
fi

log_info "Checking tamai-dev instance for resize..."

TAMAI_STATE=$(oci compute instance get \
    --instance-id "$TAMAI_INSTANCE_OCID" \
    --query 'data."lifecycle-state"' --raw-output 2>/dev/null || echo "NOT_FOUND")

if [ "$TAMAI_STATE" = "NOT_FOUND" ]; then
    log_error "tamai-dev instance not found: $TAMAI_INSTANCE_OCID"
    exit 1
fi

if [ "$TAMAI_STATE" != "RUNNING" ]; then
    log_error "tamai-dev is in state ${TAMAI_STATE} (expected RUNNING)"
    exit 1
fi

CURRENT_OCPU=$(oci compute instance get \
    --instance-id "$TAMAI_INSTANCE_OCID" \
    --query 'data."shape-config".ocpus' --raw-output 2>/dev/null || echo "")
CURRENT_MEM=$(oci compute instance get \
    --instance-id "$TAMAI_INSTANCE_OCID" \
    --query 'data."shape-config"."memory-in-gbs"' --raw-output 2>/dev/null || echo "")

log_info "Current tamai-dev spec: ${CURRENT_OCPU} OCPU / ${CURRENT_MEM}GB RAM"

if [ "$CURRENT_OCPU" != "2.0" ] && [ "$CURRENT_OCPU" != "2" ]; then
    log_success "tamai-dev already at ${CURRENT_OCPU} OCPU, no resize needed"
    exit 0
fi

echo ""
log_warn "tamai-dev will be resized: 2 OCPU / 12GB -> 1 OCPU / 8GB"
log_warn "This requires stopping the instance temporarily."
echo ""
read -p "Proceed? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    log_info "Aborted."
    exit 0
fi

log_info "Stopping tamai-dev instance..."
oci compute instance action --action SOFTSTOP \
    --instance-id "$TAMAI_INSTANCE_OCID" \
    --wait-for-state STOPPED \
    --wait-interval-seconds 10 > /dev/null

log_info "Resizing tamai-dev to 1 OCPU / 8GB..."
oci compute instance update \
    --instance-id "$TAMAI_INSTANCE_OCID" \
    --shape-config '{"ocpus":1,"memoryInGBs":8}' \
    --force > /dev/null

# Wait for resize to complete (instance stays STOPPED but briefly enters modifying state)
log_info "Waiting for resize to complete..."
for i in $(seq 1 24); do
    STATE=$(oci compute instance get \
        --instance-id "$TAMAI_INSTANCE_OCID" \
        --query 'data."lifecycle-state"' --raw-output 2>/dev/null || echo "UNKNOWN")
    if [ "$STATE" = "STOPPED" ]; then
        log_success "Resize complete"
        break
    fi
    log_info "  ... instance state: ${STATE} ($((i * 5))s)"
    sleep 5
done

log_info "Starting tamai-dev instance..."
for i in $(seq 1 6); do
    if oci compute instance action --action START \
        --instance-id "$TAMAI_INSTANCE_OCID" \
        --wait-for-state RUNNING \
        --wait-interval-seconds 10 > /dev/null 2>&1; then
        break
    fi
    if [ "$i" -eq 6 ]; then
        log_error "Failed to start instance after multiple retries"
        exit 1
    fi
    log_warn "Start failed (instance may still be modifying), retrying in 10s... (attempt $((i+1))/6)"
    sleep 10
done

echo ""
echo "============================================="
log_success "tamai-dev resized: 1 OCPU / 8GB"
echo "============================================="
echo ""
echo "Next step: ./02-oci-setup.sh"
echo ""
