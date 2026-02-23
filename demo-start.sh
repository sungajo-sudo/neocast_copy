#!/bin/bash
# NeoCast Demo Starter
# Usage: sh demo-start.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$ROOT/server"
CLIENT_DIR="$ROOT/client"

echo ""
echo "🚀 NeoCast 데모 시작..."
echo ""

# Kill any previous processes on 3000/3001
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Start server
echo "▶ 서버 시작 (포트 3001)..."
cd "$SERVER_DIR" && npm start &
SERVER_PID=$!

sleep 2

# Start client
echo "▶ 클라이언트 시작 (포트 3000)..."
cd "$CLIENT_DIR" && VITE_SOCKET_URL=http://localhost:3001 npm run dev &
CLIENT_PID=$!

sleep 3

echo ""
echo "═══════════════════════════════════════════"
echo "  🎉 NeoCast 데모 실행 완료!"
echo ""
echo "  서버:    http://localhost:3001"
echo "  클라이언트: http://localhost:3000"
echo ""
echo "  📋 테스트 시나리오:"
echo "  1. 탭 1 열기: http://localhost:3000"
echo "     → '선생님(호스트)' 탭 → 닉네임 입력 → 세션 만들기"
echo "     → 6자리 코드 확인"
echo ""
echo "  2. 탭 2 열기: http://localhost:3000"  
echo "     → '학생(게스트)' 탭 → 닉네임 + 코드 입력 → 세션 참가"
echo "     → 캔버스에 마우스로 필기"
echo ""
echo "  3. 탭 1(호스트)에서:"
echo "     → 학생 카드 클릭 → 확대 보기"
echo "     → '첨삭 모드' 버튼 ON → 마우스로 그리기"
echo "     → 탭 2에서 빨간 첨삭 실시간 확인"
echo "═══════════════════════════════════════════"
echo ""
echo "  종료: Ctrl+C"
echo ""

# Trap SIGINT
cleanup() {
  echo ""
  echo "🛑 데모 종료..."
  kill $SERVER_PID $CLIENT_PID 2>/dev/null
  lsof -ti:3001 | xargs kill -9 2>/dev/null
  lsof -ti:3000 | xargs kill -9 2>/dev/null
  exit 0
}
trap cleanup INT TERM

wait
