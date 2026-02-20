#!/bin/bash
# Temporary script: create instance only (compartment/VCN/subnet already exist)
# Delete this file after successful execution.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

COMPARTMENT_ID="$OCI_COMPARTMENT_OCID"

log_info "Searching for ARM A1 instance image..."
IMAGE_ID=$(oci compute image list \
    --compartment-id "$COMPARTMENT_ID" \
    --operating-system "Oracle Linux" \
    --operating-system-version "8" \
    --shape "VM.Standard.A1.Flex" \
    --sort-by TIMECREATED \
    --sort-order DESC \
    --query 'data[0].id' --raw-output)

if [ -z "$IMAGE_ID" ] || [ "$IMAGE_ID" = "null" ]; then
    log_error "Oracle Linux 8 ARM image not found"
    exit 1
fi
log_info "Image: $IMAGE_ID"

if [ ! -f "$SSH_PUBLIC_KEY_PATH" ]; then
    log_error "SSH public key not found: $SSH_PUBLIC_KEY_PATH"
    exit 1
fi
SSH_KEY=$(cat "$SSH_PUBLIC_KEY_PATH")

log_info "Creating ARM A1 instance (3 OCPU, 16GB RAM)..."
INSTANCE_ID=$(oci compute instance launch \
    --compartment-id "$COMPARTMENT_ID" \
    --availability-domain "$(oci iam availability-domain list --compartment-id "$OCI_TENANCY_OCID" --query 'data[0].name' --raw-output)" \
    --shape "VM.Standard.A1.Flex" \
    --shape-config '{"ocpus":3,"memoryInGBs":16}' \
    --display-name "neocast-dev" \
    --image-id "$IMAGE_ID" \
    --subnet-id "$SUBNET_OCID" \
    --assign-public-ip true \
    --metadata "{\"ssh_authorized_keys\":\"${SSH_KEY}\"}" \
    --query 'data.id' --raw-output)

update_config "INSTANCE_OCID" "$INSTANCE_ID"
log_success "Instance: $INSTANCE_ID"

log_info "Waiting for instance to start..."
oci compute instance get \
    --instance-id "$INSTANCE_ID" \
    --wait-for-state RUNNING \
    --wait-interval-seconds 10 > /dev/null

log_info "Waiting for Public IP assignment..."
PUBLIC_IP=""
for i in $(seq 1 12); do
    sleep 5
    PUBLIC_IP=$(oci compute instance list-vnics \
        --instance-id "$INSTANCE_ID" \
        --query 'data[0]."public-ip"' --raw-output 2>/dev/null || echo "")
    if [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "null" ] && [ "$PUBLIC_IP" != "None" ]; then
        break
    fi
    log_info "  ... waiting ($((i * 5))s)"
    PUBLIC_IP=""
done

if [ -z "$PUBLIC_IP" ]; then
    log_error "Public IP assignment failed."
    exit 1
fi

update_config "INSTANCE_PUBLIC_IP" "$PUBLIC_IP"

echo ""
echo "============================================="
log_success "Instance created!"
echo "============================================="
echo "  Instance : $INSTANCE_ID"
echo "  Public IP: $PUBLIC_IP"
echo ""
echo "Verify SSH: ssh -i ${SSH_PRIVATE_KEY_PATH} ${SSH_USER}@${PUBLIC_IP}"
echo ""
echo "You can delete this file now: rm $0"
