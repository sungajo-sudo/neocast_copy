# NeoCAST - OCI 개발 환경 배포 스크립트

## 인스턴스 사양

| 항목 | 값 |
|------|------|
| Shape | VM.Standard.A1.Flex (ARM Ampere) |
| OCPU | 3 |
| RAM | 16GB |
| OS | Oracle Linux 8 (aarch64) |
| 비용 | Always Free |
| 리전 | ap-seoul-1 |
| 도메인 | neocast.neolab.net |

### Always Free A1 리소스 배분

| 인스턴스 | OCPU | RAM |
|---------|------|-----|
| tamai-dev | 1 | 8GB |
| neocast-dev | 3 | 16GB |
| **합계** | **4** | **24GB** |

## 사전 준비

1. **OCI CLI** 설치 및 `~/.oci/config` 설정
2. **SSH 키** 생성
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/oci_neocast
   ```
3. **Docker Desktop** — 로컬 빌드용 (ARM64 빌드 지원 필요)
4. **환경변수 파일** — `.env.production.example`을 `.env`로 복사 후 값 설정

## 스크립트 실행 순서

```bash
cd deploy-scripts/oci

# 0. (선택) 기존 리소스 삭제 (재구축 시)
#    컴파트먼트, VCN, 인스턴스 등 전체 삭제
./00-teardown.sh

# 1. tamai-dev 인스턴스 리사이즈 (최초 1회)
#    2 OCPU / 12GB → 1 OCPU / 8GB (neocast용 리소스 확보)
./01-resize-tamai.sh

# 2. OCI 리소스 생성 (최초 1회)
#    컴파트먼트, VCN, 서브넷, Security List, ARM A1 인스턴스
#    + Object Storage 버킷 생성, API Key 발급, IAM Policy 설정
#    ★ 완료 후 출력되는 Public IP를 확인
./02-oci-setup.sh

# ★ DNS A 레코드 설정 (수동)
#    02에서 출력된 Public IP로 DNS A 레코드를 설정
#    예: neocast.neolab.net -> 140.238.18.120
#    확인: dig +short neocast.neolab.net

# 3. 서버 초기 설정 (최초 1회)
#    SSH 포트 변경, Docker, nginx(HTTP), certbot 설치, .env 생성
./03-server-init.sh

# 3b. SSL 인증서 발급 (DNS 설정 완료 후)
#     Let's Encrypt 인증서 발급 + nginx SSL 적용
./04-ssl-setup.sh

# 4. 앱 배포 (반복)
#    로컬 Docker build → scp 이미지 → docker compose up → 헬스체크
./05-deploy.sh all          # 전체 배포
./05-deploy.sh api          # API만 배포
./05-deploy.sh web          # Web만 배포
./05-deploy.sh admin        # Admin만 배포
```

## 파일 구조

```
deploy-scripts/oci/
├── config.sh                   # 공통 변수 (OCI OCID, SSH, 배포 경로)
├── 00-teardown.sh              # 기존 리소스 전체 삭제 (재구축용)
├── 01-resize-tamai.sh          # tamai-dev 인스턴스 리사이즈
├── 02-oci-setup.sh             # OCI 리소스 초기 생성 (컴파트먼트 + 인스턴스 + 버킷 + API Key)
├── 03-server-init.sh           # 서버 초기 설정 (Docker + nginx HTTP + certbot + .env)
├── 04-ssl-setup.sh             # SSL 인증서 발급 (DNS 설정 후 실행)
├── 05-deploy.sh                # 빌드 + 배포
├── docker-compose.prod.yml     # Docker Compose 프로덕션 설정
├── nginx-neocast.conf          # Nginx 리버스 프록시 + SSL 설정
├── .env.production.example     # 환경변수 템플릿
├── .oci-keys/                  # API Key PEM 파일 (gitignored)
└── README.md
```

## 아키텍처

```
                    ┌─── Internet ───┐
                    │                │
              ┌─────▼─────┐         │
              │   Nginx   │ :443    │
              │  (SSL)    │ :80     │
              └─────┬─────┘         │
                    │               │
    ┌───────────────┼───────────────┤
    │               │               │
    ▼               ▼               ▼
┌────────┐   ┌──────────┐   ┌──────────┐
│  Web   │   │   API    │   │  Admin   │
│ :8080  │   │  :8190   │   │  :8081   │
└────────┘   └────┬─────┘   └──────────┘
                  │
            ┌─────┼─────┐
            ▼     │     ▼
      ┌──────────┐│┌─────────┐
      │PostgreSQL│││  Redis  │
      │  :5432   │││  :6379  │
      └──────────┘│└─────────┘
                  │
                  ▼
      ┌─────────────────────┐
      │  OCI Object Storage │
      │  neocast-files      │
      │  neocast-papers     │
      └─────────────────────┘
```

- **Nginx**: 리버스 프록시 + SSL 종단, WebSocket 지원
- **Web** (`:8080`): React SPA (기본 경로 `/`)
- **API** (`:8190`): Node.js + Socket.IO (`/api/*`, `/socket.io/*`)
- **Admin** (`:8081`): Admin Dashboard (`/admin/*`)
- **PostgreSQL**: 데이터 저장
- **Redis**: 세션/캐시
- **OCI Object Storage**: 파일 저장 (neocast-files: 채팅 첨부, neocast-papers: NCode PDF)
- 모든 앱 포트는 `127.0.0.1`에만 바인딩 (외부 직접 접근 불가)

## 개발서버 접속

### SSH

```bash
ssh -i ~/.ssh/oci_neocast -p 22022 opc@<INSTANCE_PUBLIC_IP>
```

### 앱 URL

| 용도 | URL |
|------|-----|
| 웹 | https://neocast.neolab.net |
| Admin | https://neocast.neolab.net/admin/ |
| API 헬스체크 | https://neocast.neolab.net/api/health |

## 열린 포트 (Security List)

| 포트 | 용도 |
|------|------|
| 22022 | SSH |
| 80 | HTTP (certbot 갱신 + HTTPS 리다이렉트) |
| 443 | HTTPS (nginx -> Docker containers) |

- SSH(22)는 외부에서 접근 불가
- 앱 포트(3000, 8080, 8081, 5432, 6379)는 서버 내부에서만 접근 가능

## 서비스 관리

```bash
# SSH 접속 후
cd /opt/neocast

# Docker 서비스 관리
docker compose ps                      # 컨테이너 상태
docker compose logs -f api             # API 실시간 로그
docker compose logs --tail=50          # 최근 50줄 로그
docker compose restart api             # API 재시작
docker compose down                    # 전체 중지
docker compose up -d                   # 전체 시작

# Nginx 관리
sudo systemctl status nginx            # nginx 상태
sudo nginx -t && sudo systemctl reload nginx  # 설정 리로드

# SSL 인증서
sudo certbot renew --dry-run           # 갱신 테스트
sudo certbot certificates              # 인증서 상태

# DB 접속
docker compose exec postgres psql -U penstream penstream
```

## 트러블슈팅

### Docker 이미지 로드 실패

ARM64 이미지인지 확인:
```bash
docker inspect neocast-api:latest | grep Architecture
# 출력: "Architecture": "arm64"
```

로컬 빌드 시 `--platform linux/arm64` 필요 (05-deploy.sh에 포함)

### 컨테이너가 시작되지 않을 때

```bash
docker compose logs api    # 에러 로그 확인
docker compose ps          # 상태 확인 (Exit code)

# .env 파일 확인
cat /opt/neocast/.env
```

### SSL 인증서 발급 실패

1. DNS가 인스턴스 IP를 가리키는지 확인
2. 80번 포트가 열려있는지 확인 (Security List + firewall)
3. 수동 발급 시도:
   ```bash
   sudo certbot certonly --standalone -d neocast.neolab.net
   ```

### 디스크 공간 부족

```bash
# Docker 미사용 리소스 정리
docker system prune -a --volumes

# 디스크 사용량 확인
df -h
du -sh /opt/neocast/
```
