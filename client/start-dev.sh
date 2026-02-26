#!/bin/bash

# NeoCast Client Dev Server 시작 스크립트

cd "$(dirname "$0")"

# 이미 실행 중인지 확인
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ 서버가 이미 실행 중입니다 (포트 3000)"
    echo "   http://localhost:3000"
    exit 0
fi

# 백그라운드로 서버 시작
echo "🚀 NeoCast Client 서버를 시작합니다..."
nohup npm run dev > dev-server.log 2>&1 &

# PID 저장
echo $! > .dev-server.pid

# 서버 시작 대기
sleep 3

if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ 서버가 성공적으로 시작되었습니다!"
    echo "   http://localhost:3000"
    echo "   로그: $(pwd)/dev-server.log"
    echo "   중지: ./stop-dev.sh"
else
    echo "❌ 서버 시작 실패. 로그를 확인하세요:"
    echo "   tail -f $(pwd)/dev-server.log"
    exit 1
fi
