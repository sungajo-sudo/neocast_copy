#!/bin/bash
# =============================================================================
# NeoCAST - OCI Resource Initial Setup
# Compartment + VCN + ARM Ampere A1 Always Free Instance (3 OCPU / 16GB)
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

# --- 1. Create Compartment ---
log_info "Creating neocast compartment..."
COMPARTMENT_ID=$(oci iam compartment create \
    --compartment-id "$OCI_TENANCY_OCID" \
    --name "neocast" \
    --description "NeoCAST dev environment" \
    --query 'data.id' --raw-output 2>/dev/null || true)

if [ -z "$COMPARTMENT_ID" ]; then
    log_warn "Compartment may already exist. Searching for existing compartment..."
    COMPARTMENT_ID=$(oci iam compartment list \
        --compartment-id "$OCI_TENANCY_OCID" \
        --name "neocast" \
        --lifecycle-state ACTIVE \
        --query 'data[0].id' --raw-output)
fi

if [ -z "$COMPARTMENT_ID" ] || [ "$COMPARTMENT_ID" = "null" ]; then
    log_error "Compartment creation/lookup failed"
    exit 1
fi

update_config "OCI_COMPARTMENT_OCID" "$COMPARTMENT_ID"
export OCI_COMPARTMENT_OCID="$COMPARTMENT_ID"
log_success "Compartment: $COMPARTMENT_ID"

# Wait for compartment activation
log_info "Waiting for compartment activation (max 60s)..."
for i in $(seq 1 12); do
    STATE=$(oci iam compartment get --compartment-id "$COMPARTMENT_ID" --query 'data."lifecycle-state"' --raw-output 2>/dev/null || echo "UNKNOWN")
    if [ "$STATE" = "ACTIVE" ]; then
        log_success "Compartment activated"
        break
    fi
    sleep 5
done

# --- 2. Create VCN ---
log_info "Creating VCN..."
VCN_ID=$(oci network vcn create \
    --compartment-id "$COMPARTMENT_ID" \
    --cidr-blocks '["10.0.0.0/16"]' \
    --display-name "neocast-vcn" \
    --dns-label "neocastvcn" \
    --query 'data.id' --raw-output)

update_config "VCN_OCID" "$VCN_ID"
log_success "VCN: $VCN_ID"

# --- 3. Internet Gateway ---
log_info "Creating Internet Gateway..."
IGW_ID=$(oci network internet-gateway create \
    --compartment-id "$COMPARTMENT_ID" \
    --vcn-id "$VCN_ID" \
    --display-name "neocast-igw" \
    --is-enabled true \
    --query 'data.id' --raw-output)

update_config "IGW_OCID" "$IGW_ID"
log_success "Internet Gateway: $IGW_ID"

# --- 4. Update Route Table ---
log_info "Configuring Route Table..."
RT_ID=$(oci network vcn get \
    --vcn-id "$VCN_ID" \
    --query 'data."default-route-table-id"' --raw-output)

oci network route-table update \
    --rt-id "$RT_ID" \
    --route-rules "[{\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\",\"networkEntityId\":\"${IGW_ID}\"}]" \
    --force > /dev/null

update_config "ROUTE_TABLE_OCID" "$RT_ID"
log_success "Route Table: $RT_ID"

# --- 5. Security List ---
log_info "Configuring Security List..."
SL_ID=$(oci network vcn get \
    --vcn-id "$VCN_ID" \
    --query 'data."default-security-list-id"' --raw-output)

oci network security-list update \
    --security-list-id "$SL_ID" \
    --ingress-security-rules "[
        {\"source\":\"0.0.0.0/0\",\"protocol\":\"6\",\"tcpOptions\":{\"destinationPortRange\":{\"min\":22,\"max\":22}},\"description\":\"SSH (initial setup, removed by 03-server-init)\",\"isStateless\":false},
        {\"source\":\"0.0.0.0/0\",\"protocol\":\"6\",\"tcpOptions\":{\"destinationPortRange\":{\"min\":${SSH_PORT},\"max\":${SSH_PORT}}},\"description\":\"SSH\",\"isStateless\":false},
        {\"source\":\"0.0.0.0/0\",\"protocol\":\"6\",\"tcpOptions\":{\"destinationPortRange\":{\"min\":80,\"max\":80}},\"description\":\"HTTP (certbot)\",\"isStateless\":false},
        {\"source\":\"0.0.0.0/0\",\"protocol\":\"6\",\"tcpOptions\":{\"destinationPortRange\":{\"min\":443,\"max\":443}},\"description\":\"HTTPS\",\"isStateless\":false},
        {\"source\":\"10.0.0.0/16\",\"protocol\":\"all\",\"description\":\"VCN internal\",\"isStateless\":false}
    ]" \
    --egress-security-rules "[
        {\"destination\":\"0.0.0.0/0\",\"protocol\":\"all\",\"description\":\"All egress\",\"isStateless\":false}
    ]" \
    --force > /dev/null

update_config "SECURITY_LIST_OCID" "$SL_ID"
log_success "Security List: $SL_ID (SSH:22+${SSH_PORT}, HTTP:80, HTTPS:443)"

# --- 6. Public Subnet ---
log_info "Creating Public Subnet..."
SUBNET_ID=$(oci network subnet create \
    --compartment-id "$COMPARTMENT_ID" \
    --vcn-id "$VCN_ID" \
    --cidr-block "10.0.1.0/24" \
    --display-name "neocast-public-subnet" \
    --dns-label "neocastpub" \
    --prohibit-public-ip-on-vnic false \
    --query 'data.id' --raw-output)

update_config "SUBNET_OCID" "$SUBNET_ID"
log_success "Subnet: $SUBNET_ID"

# --- 7. Create ARM A1 Instance ---
log_info "Searching for ARM A1 instance image..."

# Search for Oracle Linux 8 aarch64 image
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

# Read SSH public key
if [ ! -f "$SSH_PUBLIC_KEY_PATH" ]; then
    log_error "SSH public key not found: $SSH_PUBLIC_KEY_PATH"
    log_info "Please generate a key first: ssh-keygen -t ed25519 -f ~/.ssh/oci_neocast"
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
    --subnet-id "$SUBNET_ID" \
    --assign-public-ip true \
    --metadata "{\"ssh_authorized_keys\":\"${SSH_KEY}\"}" \
    --query 'data.id' --raw-output)

update_config "INSTANCE_OCID" "$INSTANCE_ID"
log_success "Instance: $INSTANCE_ID"

# --- 8. Wait for instance RUNNING + Public IP ---
log_info "Waiting for instance to start and get Public IP (max 5 min)..."
PUBLIC_IP=""
for i in $(seq 1 30); do
    sleep 10
    STATE=$(oci compute instance get \
        --instance-id "$INSTANCE_ID" \
        --query 'data."lifecycle-state"' --raw-output 2>/dev/null || echo "UNKNOWN")

    if [ "$STATE" = "RUNNING" ]; then
        # Instance is running, try to get Public IP
        PUBLIC_IP=$(oci compute instance list-vnics \
            --instance-id "$INSTANCE_ID" \
            --query 'data[0]."public-ip"' --raw-output 2>/dev/null || echo "")
        if [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "null" ] && [ "$PUBLIC_IP" != "None" ]; then
            break
        fi
        log_info "  RUNNING, waiting for IP... ($((i * 10))s)"
        PUBLIC_IP=""
    else
        log_info "  state=${STATE} ($((i * 10))s)"
    fi
done

if [ -z "$PUBLIC_IP" ]; then
    log_error "Public IP assignment failed (timeout). Check manually:"
    log_error "  oci compute instance list-vnics --instance-id $INSTANCE_ID"
    exit 1
fi

update_config "INSTANCE_PUBLIC_IP" "$PUBLIC_IP"
log_success "Instance Public IP: $PUBLIC_IP"

# --- 9. OCI Object Storage Buckets ---
log_info "Creating OCI Object Storage buckets..."

OCI_NAMESPACE=$(oci os ns get --query 'data' --raw-output)
update_config "OCI_NAMESPACE" "$OCI_NAMESPACE"
log_info "Namespace: $OCI_NAMESPACE"

for BUCKET_NAME in neocast-files neocast-papers; do
    EXISTING=$(oci os bucket get \
        --namespace-name "$OCI_NAMESPACE" \
        --bucket-name "$BUCKET_NAME" \
        --query 'data.name' --raw-output 2>/dev/null || echo "")
    if [ -n "$EXISTING" ] && [ "$EXISTING" != "null" ]; then
        log_info "  Bucket $BUCKET_NAME already exists"
    else
        oci os bucket create \
            --compartment-id "$COMPARTMENT_ID" \
            --namespace-name "$OCI_NAMESPACE" \
            --name "$BUCKET_NAME" \
            --storage-tier Standard \
            --public-access-type NoPublicAccess
        log_success "  Bucket created: $BUCKET_NAME"
    fi
done

# --- 10. API Key for app authentication ---
log_info "Generating API Key for app authentication..."

OCI_API_KEY_DIR="${SCRIPT_DIR}/.oci-keys"
mkdir -p "$OCI_API_KEY_DIR"

if [ ! -f "$OCI_API_KEY_DIR/app_api_key.pem" ]; then
    openssl genrsa -out "$OCI_API_KEY_DIR/app_api_key.pem" 2048
    openssl rsa -pubout \
        -in "$OCI_API_KEY_DIR/app_api_key.pem" \
        -out "$OCI_API_KEY_DIR/app_api_key_public.pem"
    log_success "  API key pair generated"
else
    log_info "  API key pair already exists, reusing"
fi

# Get current user OCID
OCI_USER_OCID=$(oci iam user list \
    --compartment-id "$OCI_TENANCY_OCID" \
    --query 'data[0].id' --raw-output)
log_info "  User OCID: $OCI_USER_OCID"

# Upload public key
OCI_FINGERPRINT=$(oci iam user api-key upload \
    --user-id "$OCI_USER_OCID" \
    --key-file "$OCI_API_KEY_DIR/app_api_key_public.pem" \
    --query 'data.fingerprint' --raw-output 2>/dev/null || echo "")

if [ -z "$OCI_FINGERPRINT" ] || [ "$OCI_FINGERPRINT" = "null" ]; then
    # Key may already be uploaded - calculate fingerprint from public key
    OCI_FINGERPRINT=$(openssl rsa -pubin -in "$OCI_API_KEY_DIR/app_api_key_public.pem" \
        -outform DER 2>/dev/null | openssl dgst -md5 -c | sed 's/^.*= //')
    log_warn "  API key may already be uploaded, fingerprint: $OCI_FINGERPRINT"
else
    log_success "  API key uploaded, fingerprint: $OCI_FINGERPRINT"
fi

update_config "OCI_APP_USER_OCID" "$OCI_USER_OCID"
update_config "OCI_APP_FINGERPRINT" "$OCI_FINGERPRINT"

# --- 11. IAM Policy for Object Storage ---
log_info "Creating IAM Policy for Object Storage..."
oci iam policy create \
    --compartment-id "$COMPARTMENT_ID" \
    --name "neocast-storage-policy" \
    --description "Allow neocast app to manage Object Storage" \
    --statements '["Allow any-user to manage objects in compartment neocast", "Allow any-user to manage buckets in compartment neocast", "Allow any-user to manage preauthenticated-requests in compartment neocast"]' \
    2>/dev/null || log_warn "  Policy may already exist"
log_success "  IAM policy configured"

# --- Done ---
echo ""
echo "============================================="
log_success "OCI resource creation complete!"
echo "============================================="
echo ""
echo "  Compartment : $COMPARTMENT_ID"
echo "  VCN         : $VCN_ID"
echo "  Subnet      : $SUBNET_ID"
echo "  Instance    : $INSTANCE_ID"
echo "  Public IP   : $PUBLIC_IP"
echo "  Namespace   : $OCI_NAMESPACE"
echo "  Buckets     : neocast-files, neocast-papers"
echo "  API Key FP  : $OCI_FINGERPRINT"
echo ""
echo "============================================="
echo "  DNS 설정 필요"
echo "============================================="
echo ""
echo "  도메인 '${APP_DOMAIN}'의 A 레코드를 아래 IP로 설정하세요:"
echo ""
echo "    ${APP_DOMAIN}  →  ${PUBLIC_IP}"
echo ""
echo "  (DNS 전파 확인: dig +short ${APP_DOMAIN})"
echo ""
echo "============================================="
echo ""
echo "Next steps:"
echo "  1. DNS A 레코드 설정: ${APP_DOMAIN} -> ${PUBLIC_IP}"
echo "  2. SSH 확인: ssh -i ${SSH_PRIVATE_KEY_PATH} ${SSH_USER}@${PUBLIC_IP}"
echo "  3. 서버 초기 설정: ./03-server-init.sh"
echo "  4. SSL 인증서 발급: ./04-ssl-setup.sh  (DNS 설정 후)"
echo "  5. 앱 배포: ./05-deploy.sh all"
echo ""
