#!/bin/bash
# =============================================================================
# NeoCAST - Server Initial Setup (Remote execution via SSH)
# Docker + Docker Compose + Nginx (HTTP) + certbot install
# SSL 인증서는 04-ssl-setup.sh에서 별도로 발급
# Idempotent: safe to re-run after partial failure
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

if [ -z "$INSTANCE_PUBLIC_IP" ]; then
    log_error "INSTANCE_PUBLIC_IP is not set. Run 02-oci-setup.sh first."
    exit 1
fi

# --- Detect working SSH port (supports re-run after partial setup) ---
log_info "Detecting SSH port..."
CONNECT_PORT=""
for port in ${SSH_PORT} 22; do
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p $port \
        -i "$SSH_PRIVATE_KEY_PATH" "${SSH_USER}@${INSTANCE_PUBLIC_IP}" "echo ok" &>/dev/null; then
        CONNECT_PORT=$port
        break
    fi
done

if [ -z "$CONNECT_PORT" ]; then
    log_error "SSH connection failed on both port 22 and ${SSH_PORT}."
    log_error "Instance may not be ready. Try again later."
    exit 1
fi
log_success "SSH connected (port ${CONNECT_PORT})"

# --- Transfer configuration files ---
log_info "Transferring configuration files..."
scp -o StrictHostKeyChecking=no -P ${CONNECT_PORT} -i "$SSH_PRIVATE_KEY_PATH" \
    "${SCRIPT_DIR}/docker-compose.prod.yml" "${SSH_USER}@${INSTANCE_PUBLIC_IP}:/tmp/docker-compose.yml"
scp -o StrictHostKeyChecking=no -P ${CONNECT_PORT} -i "$SSH_PRIVATE_KEY_PATH" \
    "${SCRIPT_DIR}/nginx-neocast.conf" "${SSH_USER}@${INSTANCE_PUBLIC_IP}:/tmp/nginx-neocast.conf"
log_success "Files transferred"

# --- Remote server setup ---
log_info "Starting server setup..."

ssh -o StrictHostKeyChecking=no -p ${CONNECT_PORT} -i "$SSH_PRIVATE_KEY_PATH" \
    "${SSH_USER}@${INSTANCE_PUBLIC_IP}" bash -s <<REMOTE_SCRIPT
set -euo pipefail

echo ""
echo "=== [1/6] SSH port (22 -> ${SSH_PORT}) ==="
if grep -q "^Port ${SSH_PORT}" /etc/ssh/sshd_config; then
    echo "Already set to ${SSH_PORT}, skipping"
else
    sudo sed -i 's/^#Port 22/Port ${SSH_PORT}/' /etc/ssh/sshd_config
    sudo sed -i 's/^Port 22$/Port ${SSH_PORT}/' /etc/ssh/sshd_config
    if ! grep -q "^Port ${SSH_PORT}" /etc/ssh/sshd_config; then
        echo "Port ${SSH_PORT}" | sudo tee -a /etc/ssh/sshd_config
    fi
    sudo semanage port -a -t ssh_port_t -p tcp ${SSH_PORT} 2>/dev/null || \
        sudo semanage port -m -t ssh_port_t -p tcp ${SSH_PORT} 2>/dev/null || true
    sudo systemctl restart sshd
    echo "SSH port changed to ${SSH_PORT}"
fi

echo ""
echo "=== [2/6] Docker Engine + Docker Compose ==="
if command -v docker &>/dev/null; then
    echo "Docker already installed: \$(docker --version)"
else
    sudo dnf install -y dnf-utils
    sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo systemctl enable --now docker
    sudo usermod -aG docker opc
    echo "Docker installed: \$(docker --version)"
fi

echo ""
echo "=== [3/6] Deploy directory ==="
sudo mkdir -p ${DEPLOY_DIR}
sudo chown -R opc:opc ${DEPLOY_DIR}
cp /tmp/docker-compose.yml ${DEPLOY_DIR}/docker-compose.yml
echo "Deploy directory: ${DEPLOY_DIR}"

echo ""
echo "=== [4/6] Firewall ==="
sudo firewall-cmd --permanent --add-port=${SSH_PORT}/tcp 2>/dev/null || true
sudo firewall-cmd --permanent --add-service=http 2>/dev/null || true
sudo firewall-cmd --permanent --add-service=https 2>/dev/null || true
sudo firewall-cmd --permanent --remove-service=ssh 2>/dev/null || true
sudo firewall-cmd --reload 2>/dev/null || true
echo "Firewall configured"

echo ""
echo "=== [5/6] Nginx (HTTP only) ==="
if command -v nginx &>/dev/null; then
    echo "Nginx already installed"
else
    sudo dnf install -y nginx
fi
sudo mkdir -p /var/www/certbot

# HTTP-only config (certbot webroot + proxy)
sudo tee /etc/nginx/conf.d/neocast-temp.conf > /dev/null <<'TMPNGINX'
server {
    listen 80;
    server_name _;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 200 'neocast setup in progress';
        add_header Content-Type text/plain;
    }
}
TMPNGINX
sudo rm -f /etc/nginx/conf.d/neocast.conf 2>/dev/null || true
# SELinux: allow nginx to connect to upstream (Docker containers)
sudo setsebool -P httpd_can_network_connect 1 2>/dev/null || true
sudo systemctl enable --now nginx
sudo nginx -t && sudo systemctl reload nginx
echo "Nginx running (HTTP only, SELinux httpd_can_network_connect=on)"

echo ""
echo "=== [6/6] Install certbot via pip ==="
# Oracle Linux 8 ARM64 EPEL doesn't have certbot packages
if ! command -v certbot &>/dev/null || /opt/certbot/bin/python --version 2>&1 | grep -q "3\.6"; then
    echo "Installing certbot via pip (Python 3.9)..."
    # OL8 default python3 is 3.6 (too old for certbot). Use python39 module.
    sudo dnf module install -y python39
    sudo rm -rf /opt/certbot
    sudo python3.9 -m venv /opt/certbot/
    sudo /opt/certbot/bin/pip install --upgrade pip 2>&1 | tail -1
    sudo /opt/certbot/bin/pip install certbot 2>&1 | tail -1
    sudo ln -sf /opt/certbot/bin/certbot /usr/bin/certbot
    echo "certbot installed: \$(certbot --version 2>&1)"
else
    echo "certbot already installed: \$(certbot --version 2>&1)"
fi

# Remove SSH port 22 if still present
if grep -q "^Port 22\$" /etc/ssh/sshd_config; then
    sudo sed -i '/^Port 22\$/d' /etc/ssh/sshd_config
    sudo systemctl restart sshd
fi

echo ""
echo "=== Verification ==="
echo "Docker:  \$(docker --version)"
echo "Compose: \$(docker compose version)"
echo "Nginx:   \$(nginx -v 2>&1)"
echo "SSH:     \$(grep '^Port' /etc/ssh/sshd_config)"
echo "Certbot: \$(certbot --version 2>&1 || echo 'N/A')"
echo ""
echo "Server setup complete!"
REMOTE_SCRIPT

log_success "Remote setup finished"

# --- Generate .env file (skip if already exists) ---
if remote_exec "test -f ${DEPLOY_DIR}/.env" 2>/dev/null; then
    log_info ".env already exists on server, skipping"
else
    log_info "Generating .env file..."

    OCI_API_KEY_DIR="${SCRIPT_DIR}/.oci-keys"
    OCI_PRIVATE_KEY_ONELINE=""
    if [ -f "$OCI_API_KEY_DIR/app_api_key.pem" ]; then
        OCI_PRIVATE_KEY_ONELINE=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' "$OCI_API_KEY_DIR/app_api_key.pem")
    fi

    ENV_FILE=$(mktemp)
    cat > "$ENV_FILE" <<ENVEOF
# Generated by 03-server-init.sh at $(date -u +"%Y-%m-%dT%H:%M:%SZ")
DB_USER=penstream
DB_PASSWORD=$(openssl rand -hex 24)
DB_NAME=penstream
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGINS=https://${APP_DOMAIN},https://neocast-dev.neolab.net
LOG_LEVEL=info
OCI_BUCKET_PREFIX=${OCI_BUCKET_PREFIX:-neocast}
OCI_COMPARTMENT_ID=${OCI_COMPARTMENT_OCID}
OCI_REGION=${OCI_REGION}
OCI_NAMESPACE=${OCI_NAMESPACE:-}
OCI_TENANCY_ID=${OCI_TENANCY_OCID}
OCI_USER_ID=${OCI_APP_USER_OCID:-}
OCI_FINGERPRINT=${OCI_APP_FINGERPRINT:-}
OCI_PRIVATE_KEY=${OCI_PRIVATE_KEY_ONELINE}
OCI_PASSPHRASE=
NDP_LICENSE_KEY=
NDP_API_URL=
ENVEOF

    remote_copy "$ENV_FILE" "${DEPLOY_DIR}/.env"
    rm -f "$ENV_FILE"
    log_success ".env deployed to server"
fi

# --- OCI Security List final update ---
log_info "Updating OCI Security List (${SSH_PORT}, 80, 443)..."
oci network security-list update \
    --security-list-id "$SECURITY_LIST_OCID" \
    --ingress-security-rules "[
        {\"source\":\"0.0.0.0/0\",\"protocol\":\"6\",\"tcpOptions\":{\"destinationPortRange\":{\"min\":${SSH_PORT},\"max\":${SSH_PORT}}},\"description\":\"SSH\",\"isStateless\":false},
        {\"source\":\"0.0.0.0/0\",\"protocol\":\"6\",\"tcpOptions\":{\"destinationPortRange\":{\"min\":80,\"max\":80}},\"description\":\"HTTP (certbot renewal)\",\"isStateless\":false},
        {\"source\":\"0.0.0.0/0\",\"protocol\":\"6\",\"tcpOptions\":{\"destinationPortRange\":{\"min\":443,\"max\":443}},\"description\":\"HTTPS\",\"isStateless\":false},
        {\"source\":\"10.0.0.0/16\",\"protocol\":\"all\",\"description\":\"VCN internal\",\"isStateless\":false}
    ]" \
    --egress-security-rules "[
        {\"destination\":\"0.0.0.0/0\",\"protocol\":\"all\",\"description\":\"All egress\",\"isStateless\":false}
    ]" \
    --force > /dev/null
log_success "Security List updated"

echo ""
log_success "Server initial setup complete!"
echo ""
echo "  Next steps:"
echo "    1. DNS A 레코드 설정 (아직 안 했다면): ${APP_DOMAIN} -> ${INSTANCE_PUBLIC_IP}"
echo "    2. SSL 인증서 발급: ./04-ssl-setup.sh"
echo "    3. 앱 배포: ./05-deploy.sh all"
echo ""
echo "  SSH: ssh -i ${SSH_PRIVATE_KEY_PATH} -p ${SSH_PORT} ${SSH_USER}@${INSTANCE_PUBLIC_IP}"
echo ""
