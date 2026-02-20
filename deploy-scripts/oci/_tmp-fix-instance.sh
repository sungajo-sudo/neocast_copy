#!/bin/bash
# Temporary: check duplicate instances, terminate extra, save public IP.
# Delete after use: rm _tmp-fix-instance.sh _tmp-create-instance.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

# Two instances were created
INST_A="ocid1.instance.oc1.ap-seoul-1.anuwgljrn7m5vricauhss6em6pxxec3lotoo3tahbvs26obgermryredvgea"
INST_B="ocid1.instance.oc1.ap-seoul-1.anuwgljrn7m5vric7fx5sqxbpo5sl7qaujrg4va5gjsgajfbi2gh7ch5nnuq"

echo "=== Checking both instances ==="
for INST in "$INST_A" "$INST_B"; do
    SHORT="${INST##*..}"
    STATE=$(oci compute instance get --instance-id "$INST" \
        --query 'data."lifecycle-state"' --raw-output 2>/dev/null || echo "NOT_FOUND")
    IP=$(oci compute instance list-vnics --instance-id "$INST" \
        --query 'data[0]."public-ip"' --raw-output 2>/dev/null || echo "N/A")
    echo "  ...${SHORT:0:20}  state=${STATE}  ip=${IP}"
done

echo ""
echo "Instance A (_tmp-create-instance): ${INST_A##*..}"
echo "Instance B (02-oci-setup):         ${INST_B##*..}"
echo ""
read -p "Which to KEEP? (A/B): " CHOICE

case "$CHOICE" in
    [Aa])
        KEEP="$INST_A"
        TERMINATE="$INST_B"
        ;;
    [Bb])
        KEEP="$INST_B"
        TERMINATE="$INST_A"
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

# Terminate the other
log_info "Terminating duplicate instance..."
oci compute instance terminate --instance-id "$TERMINATE" --force
log_success "Terminated: ${TERMINATE##*..}"

# Update config with kept instance
update_config "INSTANCE_OCID" "$KEEP"

# Get public IP (retry)
log_info "Getting Public IP for kept instance..."
PUBLIC_IP=""
for i in $(seq 1 12); do
    PUBLIC_IP=$(oci compute instance list-vnics --instance-id "$KEEP" \
        --query 'data[0]."public-ip"' --raw-output 2>/dev/null || echo "")
    if [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "null" ] && [ "$PUBLIC_IP" != "None" ]; then
        break
    fi
    log_info "  ... waiting ($((i * 5))s)"
    PUBLIC_IP=""
    sleep 5
done

if [ -z "$PUBLIC_IP" ]; then
    log_error "Could not get Public IP"
    exit 1
fi

update_config "INSTANCE_PUBLIC_IP" "$PUBLIC_IP"

echo ""
echo "============================================="
log_success "Done!"
echo "============================================="
echo "  Instance : $KEEP"
echo "  Public IP: $PUBLIC_IP"
echo ""
echo "Verify SSH: ssh -i ${SSH_PRIVATE_KEY_PATH} ${SSH_USER}@${PUBLIC_IP}"
echo ""
echo "Cleanup: rm _tmp-fix-instance.sh _tmp-create-instance.sh"
