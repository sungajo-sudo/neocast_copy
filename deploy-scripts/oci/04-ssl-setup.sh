#!/bin/bash
# =============================================================================
# NeoCAST - SSL Certificate Setup (Let's Encrypt)
# DNS A 레코드가 서버 IP를 가리키고 있어야 실행 가능
# 03-server-init.sh 실행 후, DNS 설정 완료 후 실행
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

if [ -z "$INSTANCE_PUBLIC_IP" ]; then
    log_error "INSTANCE_PUBLIC_IP is not set. Run 02-oci-setup.sh first."
    exit 1
fi

# --- DNS check ---
log_info "Checking DNS: ${APP_DOMAIN} -> ${INSTANCE_PUBLIC_IP} ?"
DNS_IP=$(dig +short "${APP_DOMAIN}" 2>/dev/null | tail -1 || echo "")

if [ "$DNS_IP" != "$INSTANCE_PUBLIC_IP" ]; then
    log_error "DNS가 서버를 가리키지 않습니다."
    echo ""
    echo "  현재: ${APP_DOMAIN} -> ${DNS_IP:-<미설정>}"
    echo "  필요: ${APP_DOMAIN} -> ${INSTANCE_PUBLIC_IP}"
    echo ""
    echo "  DNS A 레코드를 설정한 후 다시 실행하세요."
    echo "  (DNS 전파 확인: dig +short ${APP_DOMAIN})"
    exit 1
fi
log_success "DNS OK: ${APP_DOMAIN} -> ${INSTANCE_PUBLIC_IP}"

# --- Transfer nginx SSL config ---
log_info "Transferring nginx SSL config..."
remote_copy "${SCRIPT_DIR}/nginx-neocast.conf" "/tmp/nginx-neocast.conf"

# --- Issue SSL certificate ---
log_info "Requesting SSL certificate..."

remote_exec bash -s <<REMOTE_SCRIPT
set -euo pipefail

# Verify certbot is installed
if ! command -v certbot &>/dev/null; then
    echo "certbot not found. Run 03-server-init.sh first."
    exit 1
fi

# Check if cert already exists
if [ -f "/etc/letsencrypt/live/${APP_DOMAIN}/fullchain.pem" ]; then
    echo "SSL certificate already exists."
    sudo certbot certificates 2>/dev/null | grep -A3 'Certificate Name' || true
else
    echo "Issuing certificate for ${APP_DOMAIN}..."
    # standalone 방식: nginx를 잠시 멈추고 certbot 자체 서버로 HTTP-01 검증
    sudo systemctl stop nginx
    sudo certbot certonly --standalone \
        -d ${APP_DOMAIN} \
        --non-interactive --agree-tos --email admin@neolab.net
    echo "Certificate issued"
fi

# Apply final nginx config with SSL
if [ -f "/etc/letsencrypt/live/${APP_DOMAIN}/fullchain.pem" ]; then
    sudo rm -f /etc/nginx/conf.d/neocast-temp.conf
    sudo cp /tmp/nginx-neocast.conf /etc/nginx/conf.d/neocast.conf
    sudo nginx -t && sudo systemctl restart nginx
    echo "Nginx: SSL enabled"

    # Auto-renewal cron (standalone: nginx stop/start around renewal)
    echo "0 0,12 * * * root /opt/certbot/bin/certbot renew --quiet --pre-hook 'systemctl stop nginx' --post-hook 'systemctl start nginx'" | sudo tee /etc/cron.d/certbot-renew > /dev/null
    sudo chmod 644 /etc/cron.d/certbot-renew
    echo "Auto-renewal cron configured"
fi

echo ""
echo "=== SSL Verification ==="
sudo certbot certificates 2>/dev/null | head -10
echo ""
REMOTE_SCRIPT

log_success "SSL setup complete!"
echo ""
echo "  https://${APP_DOMAIN}"
echo ""
echo "  Next: ./05-deploy.sh all"
echo ""
