import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// ── 학습 사이클 4단계 데이터 ──
const CYCLE_STEPS = [
  {
    step: 'STEP 1',
    title: '예측',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
    subtitle: '데이터 기반 수업 준비',
    desc: '이전 학습 기록을 분석해 학생의 취약점을 미리 파악하고, 수업 난이도와 방향을 설계합니다.',
    tags: ['성적 예측', '데이터 기반'],
    color: 'from-blue-500 to-indigo-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
  },
  {
    step: 'STEP 2',
    title: '접속',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
      </svg>
    ),
    subtitle: '펜 끝에서 실시간으로 연결',
    desc: '온·오프라인 관계없이, 학생의 필기 과정을 실시간으로 모니터링합니다. 펜의 움직임에서 학생의 생각이 보입니다.',
    tags: ['실시간 소통', '디지털 순회지도'],
    color: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
  },
  {
    step: 'STEP 3',
    title: '진단',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
    subtitle: '풀이 과정을 정밀하게 진단',
    desc: '정답 여부뿐 아니라, 펜이 멈춘 시간과 궤적을 분석해서 어디서 고민하고 어디서 막히는지 정확히 파악합니다.',
    tags: ['막힘 포착', '풀이 과정 리플레이'],
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
  },
  {
    step: 'STEP 4',
    title: '성장',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
    subtitle: '데이터가 증명하는 성장',
    desc: '모든 기록이 자동 저장되어 성장 리포트로 만들어집니다. 복습 자료로 활용하고, 데이터로 학생의 성장을 확인할 수 있습니다.',
    tags: ['자동 아카이브', '피드백'],
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
  },
];

// ── 핵심 가치 ──
const CORE_VALUES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: '종이 기반',
    desc: '스마트펜으로 종이에 그대로 쓰면 됩니다',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: '학습 진행 뷰어',
    desc: '학생들의 학습 진행 상황을 한눈에 파악할 수 있습니다',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    title: '자동 아카이브',
    desc: '필기 내용이 자동 저장되어 언제든 되돌아볼 수 있습니다',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
    title: '양방향 공유',
    desc: '추가 교재를 학생들에게 바로 공유할 수 있습니다',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
    title: '설치 불필요',
    desc: 'URL 하나로 접속 — 프로그램 다운로드 불필요',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
    title: '음성 가이드',
    desc: '음성 채팅으로 학생에게 실시간 가이드를 제공합니다',
  },
];

// ── AS-IS vs TO-BE 비교 ──
const COMPARISON_DATA = [
  {
    category: '교사 업무',
    asIs: '채점, 기록 관리 등 반복적인 사무 작업',
    toBe: '학습 기록이 자동 생성되어 수업 본연에 집중',
  },
  {
    category: '평가 기준',
    asIs: '결과(점수) 중심 평가',
    toBe: '0.5초 단위로 기록되는 학습 데이터, 풀이 과정 리플레이 가능',
  },
  {
    category: '개별 지도',
    asIs: '학생이 질문할 때까지 기다리는 수동적 지도',
    toBe: '필기 과정을 실시간 모니터링하여 먼저 다가가는 지도',
  },
  {
    category: '원격 모니터링',
    asIs: '얼굴 중심 화면 공유로 필기 확인이 어려움',
    toBe: '1:N 필기 동시 모니터링 + 음성 가이드',
  },
  {
    category: '인프라 비용',
    asIs: '고가의 전자칠판, 네트워크 설정 등 부담',
    toBe: '프린터만 있으면 익숙한 종이와 펜으로 바로 시작',
  },
  {
    category: '학습 몰입도',
    asIs: '태블릿 알림, 게임 등 집중을 방해하는 요소가 많음',
    toBe: '종이 필기의 집중력 + 디지털의 편리함을 결합',
  },
];

// ── 이용 방법 스텝 ──
const USAGE_STEPS = [
  {
    num: '1',
    title: '손쉬운 수업 준비와 접속',
    desc: 'PC, 태블릿, 스마트폰 어디서든 URL로 바로 접속. 별도 프로그램 설치가 필요 없습니다.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
      </svg>
    ),
  },
  {
    num: '2',
    title: '종이 교재에 그대로 필기',
    desc: 'Ncode 전용 교재는 물론, 직접 만든 학습지를 인쇄해서 바로 활용할 수 있습니다. 종이 위 손글씨로 학습 몰입도를 유지합니다.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
  },
  {
    num: '3',
    title: '필기 데이터 실시간 전송',
    desc: '필기가 바로 데이터로 변환되어 전송됩니다. 펜이 멈춘 시간까지 정밀 기록되고, 음성 채팅으로 실시간 안내도 가능합니다.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
  },
  {
    num: '4',
    title: '결과 확인 및 개별 학습 관리',
    desc: '선생님 화면에서 모든 학생의 풀이 과정을 동시에 확인. 수업 후에는 데이터 기반 리포트로 개별 관리까지.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
      </svg>
    ),
  },
];


// ═══════════════════════════════════════
// 히어로 일러스트: 교실 장면 (학생 필기 → 선생님 모니터 실시간 동기화)
// ═══════════════════════════════════════
function HeroIllustration() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.clientWidth;
    const displayH = canvas.clientHeight;
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    ctx.scale(dpr, dpr);

    let animFrame: number;
    let t = 0;

    // 수학 풀이 — 실제 필기 느낌의 SVG path 시뮬레이션
    const mathLines = [
      { text: 'x² − 5x + 6 = 0', y: 0 },
      { text: '(x−2)(x−3) = 0', y: 1 },
      { text: '∴ x = 2 또는 x = 3', y: 2 },
      { text: '검산: 4−10+6 = 0 ✓', y: 3 },
    ];
    const totalChars = mathLines.reduce((sum, l) => sum + l.text.length, 0);

    // 글자별 정보
    interface CharInfo { char: string; lineIdx: number; charIdx: number; globalIdx: number; }
    const allChars: CharInfo[] = [];
    let gi = 0;
    for (let li = 0; li < mathLines.length; li++) {
      for (let ci = 0; ci < mathLines[li].text.length; ci++) {
        allChars.push({ char: mathLines[li].text[ci], lineIdx: li, charIdx: ci, globalIdx: gi++ });
      }
    }

    // 학생 데스크 위치 (교실 장면)
    const studentNames = ['김민수', '이서연', '박준호', '최예은', '정하늘', '한지우'];

    function draw() {
      const W = displayW;
      const H = displayH;
      ctx.clearRect(0, 0, W, H);

      const isMobile = W < 500;

      // ── 배경: 교실 ──
      // 교실 바닥
      ctx.fillStyle = '#f0ebe3';
      ctx.fillRect(0, H * 0.55, W, H * 0.45);
      // 교실 벽
      const wallGrad = ctx.createLinearGradient(0, 0, 0, H * 0.55);
      wallGrad.addColorStop(0, '#f8f6f3');
      wallGrad.addColorStop(1, '#ede8e0');
      ctx.fillStyle = wallGrad;
      ctx.fillRect(0, 0, W, H * 0.55);

      // ── 전면 스크린 (선생님 모니터) ──
      const screenW = isMobile ? W * 0.52 : W * 0.48;
      const screenH = isMobile ? H * 0.34 : H * 0.38;
      const screenX = (W - screenW) / 2;
      const screenY = H * 0.04;

      // 모니터 프레임
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#1e293b';
      roundRect(ctx, screenX - 6, screenY - 6, screenW + 12, screenH + 12, 8);
      ctx.fill();
      ctx.restore();

      // 모니터 화면
      ctx.fillStyle = '#f8fafc';
      roundRect(ctx, screenX, screenY, screenW, screenH, 4);
      ctx.fill();

      // 상단 바
      ctx.fillStyle = '#f1f5f9';
      roundRect(ctx, screenX, screenY, screenW, 18, 4);
      ctx.fill();
      ctx.fillRect(screenX, screenY + 14, screenW, 4);

      ctx.fillStyle = '#94a3b8';
      ctx.font = `${isMobile ? 6 : 8}px "Noto Sans KR", sans-serif`;
      ctx.fillText('NeoCAST — 수업 모니터링', screenX + 6, screenY + 12);

      // LIVE 뱃지
      const liveW = isMobile ? 24 : 32;
      ctx.fillStyle = '#d1fae5';
      roundRect(ctx, screenX + screenW - liveW - 4, screenY + 4, liveW, 11, 5);
      ctx.fill();
      ctx.fillStyle = '#065f46';
      ctx.font = `bold ${isMobile ? 5 : 6}px "Inter", sans-serif`;
      ctx.fillText('● LIVE', screenX + screenW - liveW - 1, screenY + 12);

      // 현재까지 보이는 글자 수
      const visibleChars = Math.min(Math.floor(t * 0.7), totalChars);

      // 학생 그리드 (3x2)
      const gridPad = isMobile ? 4 : 6;
      const gridGap = isMobile ? 3 : 4;
      const gridCols = 3;
      const gridRows = 2;
      const gridAreaW = screenW - gridPad * 2;
      const gridAreaH = screenH - 22 - gridPad;
      const cellW = (gridAreaW - (gridCols - 1) * gridGap) / gridCols;
      const cellH = (gridAreaH - (gridRows - 1) * gridGap) / gridRows;

      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          const gx = screenX + gridPad + col * (cellW + gridGap);
          const gy = screenY + 20 + gridPad + row * (cellH + gridGap);
          const sIdx = row * gridCols + col;

          ctx.fillStyle = '#ffffff';
          roundRect(ctx, gx, gy, cellW, cellH, 3);
          ctx.fill();

          const isHighlighted = sIdx === 0;
          ctx.strokeStyle = isHighlighted ? '#6366f1' : '#e2e8f0';
          ctx.lineWidth = isHighlighted ? 1.5 : 0.5;
          roundRect(ctx, gx, gy, cellW, cellH, 3);
          ctx.stroke();

          // 미니 텍스트 (동기화 — 학생마다 딜레이)
          const cellVisChars = Math.max(0, visibleChars - sIdx * 3);
          const miniFontSize = isMobile ? 4 : 5;
          const miniLineH = isMobile ? 8 : 9;
          ctx.font = `${miniFontSize}px "Noto Sans KR", sans-serif`;
          ctx.fillStyle = '#334155';

          let miniIdx = 0;
          for (let li = 0; li < mathLines.length; li++) {
            const lineText = mathLines[li].text;
            const visLen = Math.max(0, Math.min(cellVisChars - miniIdx, lineText.length));
            miniIdx += lineText.length;
            if (visLen <= 0) continue;
            const partial = lineText.substring(0, visLen);
            ctx.fillText(partial, gx + 3, gy + 10 + li * miniLineH, cellW - 6);
          }

          // 학생 이름
          ctx.fillStyle = '#94a3b8';
          ctx.font = `${isMobile ? 5 : 6}px "Noto Sans KR", sans-serif`;
          ctx.fillText(studentNames[sIdx], gx + 3, gy + cellH - 3);

          // 필기중 뱃지
          if (sIdx < 4 && visibleChars > 5 && visibleChars < totalChars - 5) {
            const badgeW = isMobile ? 16 : 22;
            ctx.fillStyle = '#dbeafe';
            roundRect(ctx, gx + cellW - badgeW - 2, gy + 2, badgeW, isMobile ? 7 : 9, 3);
            ctx.fill();
            ctx.fillStyle = '#2563eb';
            ctx.font = `bold ${isMobile ? 4 : 5}px "Noto Sans KR", sans-serif`;
            ctx.fillText('필기중', gx + cellW - badgeW, gy + (isMobile ? 7 : 9));
          }
        }
      }

      // 모니터 받침대
      ctx.fillStyle = '#94a3b8';
      const standW = screenW * 0.08;
      const standH = H * 0.05;
      ctx.fillRect(screenX + (screenW - standW) / 2, screenY + screenH + 12, standW, standH);
      ctx.fillStyle = '#64748b';
      const baseW = screenW * 0.2;
      roundRect(ctx, screenX + (screenW - baseW) / 2, screenY + screenH + 12 + standH, baseW, 4, 2);
      ctx.fill();

      // ── 선생님 (모니터 앞, 뒤돌아 학생들 보는 모습) ──
      const teacherX = isMobile ? W * 0.12 : W * 0.15;
      const teacherY = H * 0.42;

      // 몸통
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.ellipse(teacherX, teacherY + 16, 10, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      // 머리
      ctx.fillStyle = '#f5d0b0';
      ctx.beginPath();
      ctx.arc(teacherX, teacherY, 8, 0, Math.PI * 2);
      ctx.fill();
      // 머리카락
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(teacherX, teacherY - 2, 8, Math.PI * 1.1, Math.PI * 1.9);
      ctx.fill();

      // 라벨
      ctx.fillStyle = '#6366f1';
      ctx.font = `bold ${isMobile ? 7 : 9}px "Noto Sans KR", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('선생님', teacherX, teacherY + 38);
      ctx.textAlign = 'start';

      // ── 학생 책상들 (앞에서 봤을 때 2열) ──
      const deskColors = ['#f5d0b0', '#e8c49a', '#f5d0b0', '#dbb896', '#f0c8a8', '#e8c49a'];
      const hairColors = ['#1a1a2e', '#4a3728', '#2d1b0e', '#1a1a2e', '#3d2b1f', '#4a3728'];
      const shirtColors = ['#93c5fd', '#fca5a5', '#86efac', '#fde68a', '#c4b5fd', '#f9a8d4'];

      const deskRowY = [H * 0.6, H * 0.78];
      const deskCols = 3;
      const deskSpacingX = isMobile ? W * 0.28 : W * 0.24;
      const deskStartX = (W - (deskCols - 1) * deskSpacingX) / 2;

      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < deskCols; col++) {
          const sIdx = row * deskCols + col;
          const dx = deskStartX + col * deskSpacingX;
          const dy = deskRowY[row];
          const scale = row === 0 ? 0.85 : 1.0;  // 앞줄은 좀 작게 (원근감)

          // 책상
          ctx.fillStyle = '#d4a574';
          const dw = (isMobile ? 44 : 56) * scale;
          const dh = (isMobile ? 24 : 30) * scale;
          roundRect(ctx, dx - dw / 2, dy, dw, dh, 3);
          ctx.fill();
          ctx.strokeStyle = '#c4956a';
          ctx.lineWidth = 0.5;
          roundRect(ctx, dx - dw / 2, dy, dw, dh, 3);
          ctx.stroke();

          // 종이 (책상 위)
          const paperW = dw * 0.65;
          const paperH = dh * 0.7;
          ctx.fillStyle = '#fff';
          ctx.fillRect(dx - paperW / 2, dy + 3, paperW, paperH);
          ctx.strokeStyle = '#e5e2da';
          ctx.lineWidth = 0.3;
          ctx.strokeRect(dx - paperW / 2, dy + 3, paperW, paperH);

          // 종이 위 미니 필기 (동기화)
          const pVisChars = Math.max(0, visibleChars - sIdx * 4);
          if (pVisChars > 0) {
            ctx.fillStyle = '#334155';
            ctx.font = `${(isMobile ? 3 : 3.5) * scale}px "Noto Sans KR", sans-serif`;
            let pIdx = 0;
            for (let li = 0; li < Math.min(mathLines.length, 3); li++) {
              const lt = mathLines[li].text;
              const vl = Math.max(0, Math.min(pVisChars - pIdx, lt.length));
              pIdx += lt.length;
              if (vl <= 0) continue;
              ctx.fillText(lt.substring(0, vl), dx - paperW / 2 + 2, dy + 7 + li * (isMobile ? 4 : 5) * scale, paperW - 4);
            }
          }

          // 학생 (책상 뒤에 앉아있는 모습 - 상반신)
          const headR = (isMobile ? 6 : 7) * scale;
          const studentY = dy - headR * 0.6;

          // 몸통 (셔츠)
          ctx.fillStyle = shirtColors[sIdx];
          ctx.beginPath();
          ctx.ellipse(dx, dy - 1, headR * 1.1, headR * 0.9, 0, 0, Math.PI);
          ctx.fill();

          // 머리
          ctx.fillStyle = deskColors[sIdx];
          ctx.beginPath();
          ctx.arc(dx, studentY - headR, headR, 0, Math.PI * 2);
          ctx.fill();

          // 머리카락
          ctx.fillStyle = hairColors[sIdx];
          ctx.beginPath();
          ctx.arc(dx, studentY - headR - 1, headR, Math.PI * 1.0, Math.PI * 2.0);
          ctx.fill();

          // 팔 (필기 중인 경우 펜 잡는 모습)
          if (sIdx < 4 && visibleChars > 3) {
            ctx.strokeStyle = deskColors[sIdx];
            ctx.lineWidth = 2.5 * scale;
            ctx.beginPath();
            ctx.moveTo(dx + headR * 0.6, dy - 1);
            ctx.quadraticCurveTo(dx + headR * 1.2, dy + dh * 0.3, dx + paperW * 0.2, dy + 5);
            ctx.stroke();

            // 작은 펜
            ctx.fillStyle = '#334155';
            ctx.save();
            ctx.translate(dx + paperW * 0.2, dy + 5);
            ctx.rotate(-0.6);
            ctx.fillRect(-1, -8, 2, 8);
            ctx.fillStyle = '#6366f1';
            ctx.fillRect(-1.5, -12, 3, 4);
            ctx.restore();
          }
        }
      }

      // ── 데이터 전송 파티클 (학생 → 모니터) ──
      if (visibleChars > 3 && visibleChars < totalChars) {
        for (let i = 0; i < 5; i++) {
          const progress = ((t * 2 + i * 20) % 100) / 100;
          const startX = deskStartX + (i % 3) * deskSpacingX;
          const startY = deskRowY[0] - 10;
          const endX = screenX + screenW / 2;
          const endY = screenY + screenH;

          const px = startX + (endX - startX) * progress;
          const py = startY + (endY - startY) * progress - Math.sin(progress * Math.PI) * 30;
          const alpha = progress < 0.2 ? progress * 5 : progress > 0.8 ? (1 - progress) * 5 : 1;

          ctx.fillStyle = `rgba(99, 102, 241, ${0.6 * alpha})`;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ── 라벨: 실시간 동기화 ──
      if (visibleChars > 5) {
        const syncAlpha = Math.min(1, (visibleChars - 5) / 10);
        ctx.fillStyle = `rgba(99, 102, 241, ${syncAlpha * 0.8})`;
        ctx.font = `bold ${isMobile ? 8 : 10}px "Noto Sans KR", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('⚡ 실시간 동기화', W / 2, H * 0.52);
        ctx.textAlign = 'start';
      }

      t += 0.5;
      if (t > totalChars / 0.7 + 80) t = 0;
      animFrame = requestAnimationFrame(draw);
    }

    draw();

    const resizeHandler = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    window.addEventListener('resize', resizeHandler);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', resizeHandler);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-2xl"
      style={{ height: 380, maxWidth: 800 }}
    />
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}


// ═══════════════════════════════════════
// LandingPage 메인 컴포넌트
// ═══════════════════════════════════════
export function LandingPage() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-app-bg">
      {/* ═══ HERO 섹션 ═══ */}
      <section className="relative overflow-hidden">
        {/* 배경 그라디언트 */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/80 via-white/60 to-purple-50/60" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-violet-200/30 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-blue-200/20 to-transparent rounded-full blur-3xl" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-10 sm:pb-16">
          {/* 텍스트 (중앙 정렬) */}
          <div className="text-center mb-8 sm:mb-10">
            <span className="neo-tag mb-3 inline-block">NeoCAST</span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 leading-[1.25] mt-3">
              떨어져 있어도, 선생님의 눈이 닿는
              <br />
              <span className="neo-gradient-text whitespace-nowrap">「손글씨로 이어지는 교육」</span>
            </h1>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed mt-4 sm:mt-5 max-w-xl mx-auto">
              다수의 문제 풀이 과정이 한눈에 보이는
              <br />
              <strong className="text-gray-800">필기 데이터에 기반한 실시간 학습 플랫폼</strong>
            </p>
            <div className="flex items-center gap-3 justify-center mt-5 sm:mt-6">
              <button
                onClick={handleStart}
                className="neo-btn-primary text-base"
              >
                시작하기
              </button>
              <button
                onClick={() => {
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="neo-btn-ghost text-base"
              >
                이용 방법 보기
              </button>
            </div>
          </div>

          {/* 메인 일러스트 (교실 장면) */}
          <div className="max-w-3xl mx-auto">
            <div className="neo-card p-3 sm:p-4 bg-white/80 backdrop-blur-sm">
              <HeroIllustration />
              <div className="flex justify-center gap-3 mt-3">
                {['교실 수업', '원격 수업', '자습 관리'].map((label) => (
                  <span key={label} className="text-[10px] sm:text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 학습 사이클 4단계 ═══ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="text-center mb-10 sm:mb-14">
          <span className="neo-tag">Learning Cycle</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-3 sm:mt-4">
            사고의 흐름을 데이터로 잇는 배움의 사이클
          </h2>
          <p className="text-gray-500 mt-2 sm:mt-3 text-sm sm:text-base">
            예측에서 성장까지 — 필기 데이터가 만드는 완전한 학습 루프
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {CYCLE_STEPS.map((step, idx) => (
            <div key={idx} className="neo-card p-5 sm:p-6 flex flex-col gap-3 sm:gap-4 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white`}>
                  {step.icon}
                </div>
                <div>
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wide">{step.step}</span>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">{step.title}</h3>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-700">{step.subtitle}</p>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed flex-1">{step.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {step.tags.map((tag) => (
                  <span key={tag} className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${step.bgColor} ${step.textColor}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ 핵심 가치 ═══ */}
      <section className="bg-gradient-to-b from-white/80 to-indigo-50/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="text-center mb-10 sm:mb-14">
            <span className="neo-tag">Core Features</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-3 sm:mt-4">
              펜과 종이로 연결되는 실시간 학습
            </h2>
            <p className="text-gray-500 mt-2 sm:mt-3 text-sm sm:text-base">
              전자칠판도, 추가 장비도 필요 없습니다.
              <br className="sm:hidden" />{' '}
              스마트펜으로 종이에 쓰기만 하면 됩니다
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {CORE_VALUES.map((item, idx) => (
              <div key={idx} className="neo-card p-5 sm:p-6 flex items-start gap-3 sm:gap-4 hover:shadow-lg transition-shadow">
                <div className="neo-icon-wrap flex-shrink-0 text-indigo-600">
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 이용 방법 ═══ */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="text-center mb-10 sm:mb-14">
          <span className="neo-tag">How to Use</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-3 sm:mt-4">
            NeoCAST 이용 방법
          </h2>
          <p className="text-gray-500 mt-2 sm:mt-3 text-sm sm:text-base">
            막힘없이, 사고의 흐름을 잡아냅니다
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {USAGE_STEPS.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center text-center gap-3 sm:gap-4">
              <div className="relative">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg">
                  {step.icon}
                </div>
                <span className="absolute -top-2 -right-2 w-6 h-6 sm:w-7 sm:h-7 bg-white border-2 border-indigo-400 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black text-indigo-600">
                  {step.num}
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base">{step.title}</h3>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* 배지 */}
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mt-10 sm:mt-12">
          {['나만의 학습지도 OK', '기존 교재도 OK', '원격 수업도 OK'].map((label) => (
            <span key={label} className="neo-card px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-gray-700 flex items-center gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* ═══ AS-IS vs TO-BE 비교 ═══ */}
      <section className="bg-gradient-to-b from-indigo-50/40 to-white/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="text-center mb-10 sm:mb-14">
            <span className="neo-tag">도입 효과</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-3 sm:mt-4">
              현장의 고민, 이렇게 해결합니다
            </h2>
            <p className="text-gray-500 mt-2 sm:mt-3 text-xs sm:text-sm">※ 일부 개발 중 기능 포함</p>
          </div>

          {/* 데스크톱 테이블 */}
          <div className="hidden md:block neo-card overflow-hidden">
            <div className="grid grid-cols-[140px_1fr_1fr] border-b-2 border-gray-100">
              <div className="px-5 py-4" />
              <div className="px-5 py-4 bg-gray-50 text-center">
                <span className="text-sm font-bold text-gray-500">AS-IS</span>
              </div>
              <div className="px-5 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-center">
                <span className="text-sm font-bold text-white">TO-BE (NeoCAST)</span>
              </div>
            </div>
            {COMPARISON_DATA.map((row, idx) => (
              <div
                key={idx}
                className={`grid grid-cols-[140px_1fr_1fr] ${idx !== COMPARISON_DATA.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div className="px-5 py-4 flex items-center">
                  <span className="text-sm font-bold text-gray-700">{row.category}</span>
                </div>
                <div className="px-5 py-4 bg-gray-50/50 flex items-center">
                  <span className="text-sm text-gray-500">{row.asIs}</span>
                </div>
                <div className="px-5 py-4 flex items-center">
                  <span className="text-sm text-indigo-700 font-medium">{row.toBe}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 모바일 카드 */}
          <div className="md:hidden flex flex-col gap-4">
            {COMPARISON_DATA.map((row, idx) => (
              <div key={idx} className="neo-card p-4">
                <h4 className="text-sm font-bold text-gray-800 mb-3">{row.category}</h4>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">AS-IS</span>
                    <span className="text-xs text-gray-500">{row.asIs}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-bold text-white bg-indigo-500 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">TO-BE</span>
                    <span className="text-xs text-indigo-700 font-medium">{row.toBe}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA 섹션 ═══ */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="neo-card p-8 sm:p-12 text-center bg-gradient-to-br from-indigo-50/80 to-purple-50/60">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
            지금 바로 체험해 보세요
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
            종이 위의 손글씨가 실시간으로 연결되는 새로운 수업을 경험하세요
          </p>
          <button
            onClick={handleStart}
            className="neo-btn-primary text-base sm:text-lg px-8 sm:px-10"
          >
            테스트 버전으로 시작
          </button>
        </div>
      </section>

      {/* ═══ 푸터 ═══ */}
      <footer className="border-t border-gray-100 bg-white/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Neo</span>
            <span className="text-lg font-bold text-gray-800">CAST</span>
          </div>
          <div className="text-xs text-gray-400 text-center sm:text-right">
            <p>NEO.LAB Convergence</p>
            <p className="mt-1">neosmartpen.jp | info@neolab.co.jp</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
