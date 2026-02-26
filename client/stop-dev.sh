#!/bin/bash

# NeoCast Client Dev Server 중지 스크립트

cd "$(dirname "$0")"

echo "🛑 NeoCast Client 서버를 중지합니다..."

# PID 파일이 있으면 해당 프로세스 종료
if [ -f .dev-server.pid ]; then
    PID=$(cat .dev-server.pid)
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID
        echo "✅ 프로세스 $PID 종료됨"
    fi
    rm .dev-server.pid
fi

# 포트 3000을 사용하는 모든 프로세스 종료
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    echo "✅ 포트 3000의 모든 프로세스 종료됨"
else
    echo "ℹ️  실행 중인 서버가 없습니다"
fi
