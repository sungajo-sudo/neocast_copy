#!/bin/bash
# =============================================================================
# NeoCAST - OCI Resource Teardown
# 컴파트먼트 내 모든 리소스를 조회하여 삭제 (OCID 의존 없음)
# 삭제 실패 시 최대 3회 재시도
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

MAX_RETRY=3

# --- Helper: OCI list 결과에서 OCID만 추출 ---
extract_ocids() {
    grep -o 'ocid1\.[^ "]*' 2>/dev/null || true
}

# --- Helper: 리소스 목록 조회 후 삭제 + 대기 + 재시도 ---
# Usage: delete_resources <label> <list_cmd> <delete_cmd_template> <wait_seconds>
#   list_cmd: OCID 목록을 반환하는 명령 (파이프 extract_ocids 포함)
#   delete_cmd_template: __ID__ 를 실제 OCID로 치환하여 실행
#   wait_seconds: 대기 간격
delete_resources() {
    local label="$1"
    local list_cmd="$2"
    local delete_cmd_template="$3"
    local wait_sec="${4:-5}"

    for attempt in $(seq 1 $MAX_RETRY); do
        local ids
        ids=$(eval "$list_cmd")
        local count=0

        while IFS= read -r rid; do
            [ -z "$rid" ] && continue
            local cmd="${delete_cmd_template/__ID__/$rid}"
            if [ "$attempt" -eq 1 ]; then
                log_info "   Deleting ${label}: $rid"
            else
                log_info "   Retry #${attempt} ${label}: $rid"
            fi
            eval "$cmd" || true
            count=$((count + 1))
        done <<< "$ids"

        if [ "$count" -eq 0 ]; then
            if [ "$attempt" -eq 1 ]; then
                log_info "   No ${label}s found"
            else
                log_success "   All ${label}s deleted"
            fi
            return 0
        fi

        # Wait for deletion to complete
        log_info "   Waiting for ${count} ${label}(s) to be deleted..."
        local deleted=false
        for i in $(seq 1 24); do
            local remaining_ids
            remaining_ids=$(eval "$list_cmd")
            local remaining=0
            while IFS= read -r r; do
                [ -z "$r" ] && continue
                remaining=$((remaining + 1))
            done <<< "$remaining_ids"

            if [ "$remaining" -eq 0 ]; then
                deleted=true
                break
            fi
            echo "   ... $remaining ${label}(s) remaining ($((i * wait_sec))s)"
            sleep "$wait_sec"
        done

        if [ "$deleted" = true ]; then
            log_success "   All ${label}s deleted"
            return 0
        fi

        if [ "$attempt" -lt "$MAX_RETRY" ]; then
            log_warn "   ${label} deletion incomplete, retrying... (attempt $((attempt + 1))/${MAX_RETRY})"
        else
            log_error "   ${label} deletion failed after ${MAX_RETRY} attempts"
            return 1
        fi
    done
}

# --- Resolve compartment ---
COMPARTMENT_ID="${OCI_COMPARTMENT_OCID:-}"
if [ -z "$COMPARTMENT_ID" ] || [ "$COMPARTMENT_ID" = "null" ]; then
    log_info "config.sh에 OCID 없음, 이름으로 검색..."
    COMPARTMENT_ID=$(oci iam compartment list \
        --compartment-id "$OCI_TENANCY_OCID" \
        --name "neocast" \
        --lifecycle-state ACTIVE \
        --query 'data[0].id' --raw-output 2>/dev/null || echo "")
fi

if [ -z "$COMPARTMENT_ID" ] || [ "$COMPARTMENT_ID" = "null" ]; then
    log_info "neocast compartment not found. Nothing to tear down."
    exit 0
fi

echo ""
echo "============================================="
echo "  NeoCAST OCI Teardown"
echo "============================================="
echo ""
echo "  Compartment: $COMPARTMENT_ID"
echo ""
echo "WARNING: 이 컴파트먼트의 모든 리소스를 삭제합니다."
read -p "Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

# =============================================================================
# 1. Terminate ALL instances
# =============================================================================
log_info "1. Terminating all instances..."
INSTANCES=$(oci compute instance list \
    --compartment-id "$COMPARTMENT_ID" \
    --lifecycle-state RUNNING \
    --query 'data[].id' 2>/dev/null | extract_ocids)
INSTANCES+=$'\n'
INSTANCES+=$(oci compute instance list \
    --compartment-id "$COMPARTMENT_ID" \
    --lifecycle-state STOPPED \
    --query 'data[].id' 2>/dev/null | extract_ocids)

INSTANCE_COUNT=0
while IFS= read -r INST_ID; do
    [ -z "$INST_ID" ] && continue
    log_info "   Terminating: $INST_ID"
    oci compute instance terminate \
        --instance-id "$INST_ID" \
        --preserve-boot-volume false \
        --force 2>/dev/null || true
    INSTANCE_COUNT=$((INSTANCE_COUNT + 1))
done <<< "$INSTANCES"

if [ "$INSTANCE_COUNT" -gt 0 ]; then
    log_info "   Waiting for instance termination (max 5 min)..."
    TERMINATED=false
    for i in $(seq 1 30); do
        R1=$(oci compute instance list --compartment-id "$COMPARTMENT_ID" \
            --lifecycle-state RUNNING --query 'data | length(@)' --raw-output 2>/dev/null || echo "0")
        R2=$(oci compute instance list --compartment-id "$COMPARTMENT_ID" \
            --lifecycle-state STOPPING --query 'data | length(@)' --raw-output 2>/dev/null || echo "0")
        R3=$(oci compute instance list --compartment-id "$COMPARTMENT_ID" \
            --lifecycle-state TERMINATING --query 'data | length(@)' --raw-output 2>/dev/null || echo "0")
        TOTAL=$(( ${R1:-0} + ${R2:-0} + ${R3:-0} ))
        if [ "$TOTAL" -eq 0 ]; then
            TERMINATED=true
            break
        fi
        echo "   ... $TOTAL instance(s) still active ($((i * 10))s)"
        sleep 10
    done
    if [ "$TERMINATED" = true ]; then
        log_success "   All instances terminated"
    else
        log_warn "   Instance termination timed out"
    fi
else
    log_info "   No active instances found"
fi

# =============================================================================
# 2. Delete ALL subnets (with retry)
# =============================================================================
log_info "2. Deleting all subnets..."
delete_resources "subnet" \
    "oci network subnet list --compartment-id '$COMPARTMENT_ID' --query 'data[].id' 2>/dev/null | extract_ocids" \
    "oci network subnet delete --subnet-id __ID__ --force 2>/dev/null" \
    5 || true

# =============================================================================
# 3. Clear ALL route table rules
# =============================================================================
log_info "3. Clearing route table rules..."
VCNS=$(oci network vcn list \
    --compartment-id "$COMPARTMENT_ID" \
    --query 'data[].id' 2>/dev/null | extract_ocids)

while IFS= read -r VCN_ID; do
    [ -z "$VCN_ID" ] && continue
    log_info "   VCN: $VCN_ID"

    RT_IDS=$(oci network route-table list \
        --compartment-id "$COMPARTMENT_ID" \
        --vcn-id "$VCN_ID" \
        --query 'data[].id' 2>/dev/null | extract_ocids)
    while IFS= read -r RT_ID; do
        [ -z "$RT_ID" ] && continue
        log_info "     Clearing route table: $RT_ID"
        oci network route-table update \
            --rt-id "$RT_ID" \
            --route-rules '[]' \
            --force > /dev/null 2>&1 || true
    done <<< "$RT_IDS"
done <<< "$VCNS"
log_success "   Route table rules cleared"

# =============================================================================
# 4. Delete ALL internet gateways (with retry)
# =============================================================================
log_info "4. Deleting all internet gateways..."
# IGW list requires --vcn-id, so iterate VCNs
for attempt in $(seq 1 $MAX_RETRY); do
    IGW_COUNT=0
    while IFS= read -r VCN_ID; do
        [ -z "$VCN_ID" ] && continue
        IGW_IDS=$(oci network internet-gateway list \
            --compartment-id "$COMPARTMENT_ID" \
            --vcn-id "$VCN_ID" \
            --query 'data[].id' 2>/dev/null | extract_ocids)
        while IFS= read -r IGW_ID; do
            [ -z "$IGW_ID" ] && continue
            log_info "   Deleting IGW: $IGW_ID"
            oci network internet-gateway delete --ig-id "$IGW_ID" --force 2>/dev/null || true
            IGW_COUNT=$((IGW_COUNT + 1))
        done <<< "$IGW_IDS"
    done <<< "$VCNS"

    if [ "$IGW_COUNT" -eq 0 ]; then
        [ "$attempt" -eq 1 ] && log_info "   No internet gateways found" || log_success "   All internet gateways deleted"
        break
    fi

    log_info "   Waiting for IGW deletion (10s)..."
    sleep 10

    if [ "$attempt" -lt "$MAX_RETRY" ]; then
        # Re-read VCN list for next attempt
        VCNS=$(oci network vcn list \
            --compartment-id "$COMPARTMENT_ID" \
            --query 'data[].id' 2>/dev/null | extract_ocids)
    fi
done

# =============================================================================
# 5. Delete ALL VCNs (with retry)
# =============================================================================
log_info "5. Deleting all VCNs..."
delete_resources "VCN" \
    "oci network vcn list --compartment-id '$COMPARTMENT_ID' --query 'data[].id' 2>/dev/null | extract_ocids" \
    "oci network vcn delete --vcn-id __ID__ --force 2>/dev/null" \
    5 || true

# =============================================================================
# 6. Delete compartment (with retry)
# =============================================================================
log_info "6. Deleting compartment..."
STATE=""
for attempt in $(seq 1 $MAX_RETRY); do
    CURRENT=$(oci iam compartment get --compartment-id "$COMPARTMENT_ID" \
        --query 'data."lifecycle-state"' --raw-output 2>/dev/null || echo "DELETED")

    if [ "$CURRENT" = "DELETED" ]; then
        log_success "   Compartment deleted"
        STATE="DELETED"
        break
    fi

    if [ "$CURRENT" != "DELETING" ]; then
        if [ "$attempt" -gt 1 ]; then
            log_info "   Retry #${attempt}: compartment is ${CURRENT}, requesting delete..."
        fi
        oci iam compartment delete \
            --compartment-id "$COMPARTMENT_ID" \
            --force 2>/dev/null || true
    else
        log_info "   Compartment already DELETING..."
    fi

    log_info "   Waiting for compartment deletion (max 3 min)..."
    for i in $(seq 1 18); do
        STATE=$(oci iam compartment get \
            --compartment-id "$COMPARTMENT_ID" \
            --query 'data."lifecycle-state"' --raw-output 2>/dev/null || echo "DELETED")
        if [ "$STATE" = "DELETED" ]; then
            log_success "   Compartment deleted"
            break 2
        fi
        echo "   ... state=${STATE} ($((i * 10))s)"
        sleep 10
    done

    # If compartment went back to ACTIVE, there may be remaining resources
    if [ "$STATE" = "ACTIVE" ] && [ "$attempt" -lt "$MAX_RETRY" ]; then
        log_warn "   Compartment reverted to ACTIVE (resources may remain). Retrying cleanup..."
        # Re-run subnet/VCN cleanup
        delete_resources "subnet" \
            "oci network subnet list --compartment-id '$COMPARTMENT_ID' --query 'data[].id' 2>/dev/null | extract_ocids" \
            "oci network subnet delete --subnet-id __ID__ --force 2>/dev/null" 5 || true

        VCNS=$(oci network vcn list --compartment-id "$COMPARTMENT_ID" \
            --query 'data[].id' 2>/dev/null | extract_ocids)
        while IFS= read -r VCN_ID; do
            [ -z "$VCN_ID" ] && continue
            RT_IDS=$(oci network route-table list --compartment-id "$COMPARTMENT_ID" \
                --vcn-id "$VCN_ID" --query 'data[].id' 2>/dev/null | extract_ocids)
            while IFS= read -r RT_ID; do
                [ -z "$RT_ID" ] && continue
                oci network route-table update --rt-id "$RT_ID" --route-rules '[]' --force > /dev/null 2>&1 || true
            done <<< "$RT_IDS"
            IGW_IDS=$(oci network internet-gateway list --compartment-id "$COMPARTMENT_ID" \
                --vcn-id "$VCN_ID" --query 'data[].id' 2>/dev/null | extract_ocids)
            while IFS= read -r IGW_ID; do
                [ -z "$IGW_ID" ] && continue
                oci network internet-gateway delete --ig-id "$IGW_ID" --force 2>/dev/null || true
            done <<< "$IGW_IDS"
        done <<< "$VCNS"
        sleep 10

        delete_resources "VCN" \
            "oci network vcn list --compartment-id '$COMPARTMENT_ID' --query 'data[].id' 2>/dev/null | extract_ocids" \
            "oci network vcn delete --vcn-id __ID__ --force 2>/dev/null" 5 || true
    fi
done

if [ "$STATE" != "DELETED" ]; then
    log_warn "   Compartment still ${STATE} after ${MAX_RETRY} attempts."
    log_warn "   Check OCI Console manually."
fi

# =============================================================================
# 7. Reset config.sh
# =============================================================================
log_info "7. Resetting config.sh OCID values..."
update_config "OCI_COMPARTMENT_OCID" ""
update_config "INSTANCE_OCID" ""
update_config "INSTANCE_PUBLIC_IP" ""
update_config "VCN_OCID" ""
update_config "SUBNET_OCID" ""
update_config "IGW_OCID" ""
update_config "ROUTE_TABLE_OCID" ""
update_config "SECURITY_LIST_OCID" ""
update_config "OCI_NAMESPACE" ""
update_config "OCI_APP_USER_OCID" ""
update_config "OCI_APP_FINGERPRINT" ""
log_success "   config.sh reset"

echo ""
echo "============================================="
log_success "Teardown complete!"
echo "============================================="
echo ""
echo "To recreate from scratch:"
echo "  1. Wait for compartment deletion to finish (check OCI Console)"
echo "  2. Run: ./02-oci-setup.sh"
echo ""
