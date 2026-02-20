#!/bin/bash
# =============================================================================
# NeoCAST - OCI Deploy Common Configuration
# =============================================================================

# --- OCI Tenancy ---
export OCI_TENANCY_OCID="ocid1.tenancy.oc1..aaaaaaaass6ykzlrssz7qfy2rhwxjpwioypkemjh6rxi4tqoz4vqr76olxaa"
export OCI_REGION="ap-seoul-1"

# --- Compartment (auto-recorded after running 01-oci-setup.sh) ---
export OCI_COMPARTMENT_OCID="ocid1.compartment.oc1..aaaaaaaaeyphunthx2nbjcuthibl26phyrje354hozrdoz5pefofnsus4rpq"

# --- SSH ---
export SSH_PUBLIC_KEY_PATH="$HOME/.ssh/oci_kitty.pub"
export SSH_PRIVATE_KEY_PATH="$HOME/.ssh/oci_kitty"
export SSH_USER="opc"

# --- Instance (auto-recorded after running 01-oci-setup.sh) ---
export INSTANCE_OCID="ocid1.instance.oc1.ap-seoul-1.anuwgljrn7m5vrico5we75jbbkdgcqj4ohui4ae7blmqxa5kf3pglpb5ojcq"
export INSTANCE_PUBLIC_IP="140.238.3.16"

# --- Network (auto-recorded after running 01-oci-setup.sh) ---
export VCN_OCID="ocid1.vcn.oc1.ap-seoul-1.amaaaaaan7m5vriand3a5oislrew4n4p6hcmvgbdpuyuqjaak4pu6bxxqocq"
export SUBNET_OCID="ocid1.subnet.oc1.ap-seoul-1.aaaaaaaasey6ir43wuffokatynyil7lo5h2fowhhlpiepbav2wyjkrez7ncq"
export IGW_OCID="ocid1.internetgateway.oc1.ap-seoul-1.aaaaaaaavzooq6ixzmlx3c3yaoeht6jpjqrcohff5pzva3hfmtppc5gxqdta"
export ROUTE_TABLE_OCID="ocid1.routetable.oc1.ap-seoul-1.aaaaaaaa6dfljxxxjnhndiuxdow4cv6d46mldobwa5pcp523i33zyk6dpu7a"
export SECURITY_LIST_OCID="ocid1.securitylist.oc1.ap-seoul-1.aaaaaaaadxqmx4v5bjrbtsxmzd3uu673ltdbn5jg5bklesnookvrryoa346q"

# --- OCI Object Storage (auto-recorded after running 02-oci-setup.sh) ---
export OCI_NAMESPACE="cnamcdqozzvl"
export OCI_APP_USER_OCID="ocid1.user.oc1..aaaaaaaa3prssd2d7zdxdewsglkinqyb63bk7p4t6pmp7fkh4sv2wgptrhhq"
export OCI_APP_FINGERPRINT="ae:52:97:e8:dc:a2:f2:cd:0a:06:a6:fa:97:7b:54:dc"
export OCI_BUCKET_PREFIX="neocast"

# --- tamai instance (for resize in 01-oci-setup.sh) ---
export TAMAI_INSTANCE_OCID="ocid1.instance.oc1.ap-seoul-1.anuwgljrn7m5vrickekoqlf77qvw4iiu5wzba5flhnwycueo4usksdql527q"

# --- Deploy settings ---
export DEPLOY_DIR="/opt/neocast"
export APP_DOMAIN="neocast.neolab.net"
export SSH_PORT=22022

# --- Project path ---
export PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# --- Utility functions ---
log_info() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

log_success() {
    echo -e "\033[1;32m[OK]\033[0m $1"
}

log_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

log_warn() {
    echo -e "\033[1;33m[WARN]\033[0m $1"
}

# Helper to update config.sh itself
update_config() {
    local key="$1"
    local value="$2"
    local config_file="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.sh"
    if grep -q "^export ${key}=" "$config_file"; then
        sed -i.bak "s|^export ${key}=.*|export ${key}=\"${value}\"|" "$config_file"
        rm -f "${config_file}.bak"
        log_info "${key} updated: ${value}"
    fi
}

# SSH wrapper
remote_exec() {
    ssh -o StrictHostKeyChecking=no -p "${SSH_PORT:-22}" -i "$SSH_PRIVATE_KEY_PATH" "${SSH_USER}@${INSTANCE_PUBLIC_IP}" "$@"
}

remote_copy() {
    scp -o StrictHostKeyChecking=no -P "${SSH_PORT:-22}" -i "$SSH_PRIVATE_KEY_PATH" "$1" "${SSH_USER}@${INSTANCE_PUBLIC_IP}:$2"
}
