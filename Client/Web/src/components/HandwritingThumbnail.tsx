import React, { useEffect, useRef } from 'react';

interface Props {
  seed: number;
  studentName?: string;
  pageNum?: number;
}

// 페이지별 워크시트 배경 텍스트
const PAGE_BACKGROUNDS: { header: string; subHeader: string; problem: string; equation: string }[] = [
  {
    header: '이차방정식 예제풀이 (인수분해)',
    subHeader: '문제 1.',
    problem: '다음 이차방정식을 인수분해법으로 풀어보세요.',
    equation: 'x² - 5x + 6 = 0',
  },
  {
    header: '이차방정식 예제풀이 (근의 공식)',
    subHeader: '문제 2.',
    problem: '근의 공식을 이용하여 풀어보세요.',
    equation: '2x² + 3x - 2 = 0',
  },
  {
    header: '이차방정식 서술형 평가',
    subHeader: '문제 3.',
    problem: '다음 이차방정식의 두 근의 합과 곱을 구하세요.',
    equation: 'x² - 7x + 12 = 0',
  },
];

// 학생별 필기 패턴 (seed + pageNum 조합으로 다양한 풀이)
const HANDWRITING_SETS: { lines: string[]; color: string; offsetY: number }[][] = [
  // 학생 0 (꼼꼼한 풀이)
  [
    { lines: ['x² - 5x + 6 = 0', '(x - 2)(x - 3) = 0', '∴ x = 2 또는 x = 3'], color: '#1a1a2e', offsetY: 0 },
    { lines: ['x = (-3 ± √(9+16)) / 4', 'x = (-3 ± 5) / 4', 'x = 1/2 또는 x = -2'], color: '#1a1a2e', offsetY: 0 },
    { lines: ['근과 계수의 관계:', '합: -(-7)/1 = 7', '곱: 12/1 = 12'], color: '#1a1a2e', offsetY: 0 },
  ],
  // 학생 1 (자세한 검산 포함)
  [
    { lines: ['x² - 5x + 6 = 0', '두 근의 합=5, 곱=6', '(x-2)(x-3) = 0', 'x = 2 또는 x = 3', '검산: 4-10+6=0 ✓'], color: '#1a1a2e', offsetY: 0 },
    { lines: ['2x² + 3x - 2 = 0', 'a=2, b=3, c=-2', 'D = 9+16 = 25', 'x = (-3±5)/4', 'x=1/2, x=-2'], color: '#1a1a2e', offsetY: 0 },
    { lines: ['합: 7, 곱: 12', '(x-3)(x-4) = 0', '검산: 3+4=7, 3×4=12 ✓'], color: '#1a1a2e', offsetY: 0 },
  ],
  // 학생 2 (간략한 풀이)
  [
    { lines: ['x² - 5x + 6 = 0', '합:5 곱:6 탐색...', '(x-2)(x-3)=0'], color: '#1a1a2e', offsetY: 0 },
    { lines: ['근의 공식 적용', 'x = (-3 ± √25) / 4', '...계산 중'], color: '#1a1a2e', offsetY: 0 },
    { lines: ['합 = 7', '곱 = 12'], color: '#1a1a2e', offsetY: 0 },
  ],
  // 학생 3 (정리 잘 하는 스타일)
  [
    { lines: ['[풀이]', 'x² - 5x + 6 = 0', '→ (x-2)(x-3) = 0', '→ x = 2, x = 3', '[답] x = 2 또는 3'], color: '#1a1a2e', offsetY: 0 },
    { lines: ['[풀이]', '2x²+3x-2 = 0', 'D = b²-4ac = 25', 'x = (-3±5)/4', '[답] x=1/2, -2'], color: '#1a1a2e', offsetY: 0 },
    { lines: ['[풀이]', '비에타 공식 적용', '합: -b/a = 7', '곱: c/a = 12', '[답] 합=7, 곱=12'], color: '#1a1a2e', offsetY: 0 },
  ],
  // 학생 4 (미완성 / 미필기 많음)
  [
    { lines: ['x² - 5x + 6 = 0', '...'], color: '#999', offsetY: 0 },
    { lines: ['2x² + 3x - 2 = 0', '근의 공식...', 'x = (-3 ± ?) / 4'], color: '#999', offsetY: 0 },
    { lines: [], color: '#999', offsetY: 0 },
  ],
];

export const HandwritingThumbnail: React.FC<Props> = ({ seed, studentName, pageNum = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    ctx.clearRect(0, 0, W, canvas.height);

    const bgIdx = (pageNum - 1 + 30) % PAGE_BACKGROUNDS.length;
    const bg = PAGE_BACKGROUNDS[bgIdx];

    // 배경: 워크시트 인쇄 텍스트
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, canvas.height);

    // 얇은 가로선 (노트 줄)
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    for (let y = 80; y < canvas.height; y += 36) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(W - 20, y);
      ctx.stroke();
    }

    // 헤더 영역 배경
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, W, 110);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 110);
    ctx.lineTo(W, 110);
    ctx.stroke();

    // 워크시트 제목
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 22px "Noto Sans KR", sans-serif';
    ctx.fillText(bg.header, 24, 40);

    // 학년/반, 이름 필드
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px "Noto Sans KR", sans-serif';
    ctx.fillText('학년/반:          이름:', 24, 70);

    // 학생 이름 (필기체 느낌)
    if (studentName) {
      ctx.fillStyle = '#1e293b';
      ctx.font = 'italic 15px "Noto Sans KR", sans-serif';
      ctx.fillText(studentName, 172, 70);
    }

    // 문제 번호 + 문제 텍스트
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px "Noto Sans KR", sans-serif';
    ctx.fillText(bg.subHeader, 24, 148);

    ctx.fillStyle = '#475569';
    ctx.font = '15px "Noto Sans KR", sans-serif';
    ctx.fillText(bg.problem, 24, 178);

    // 수식
    ctx.fillStyle = '#1e293b';
    ctx.font = '17px "Noto Sans KR", sans-serif';
    ctx.fillText(bg.equation, 24, 216);

    // 학생 필기 (손글씨 느낌)
    const studentIdx = seed % HANDWRITING_SETS.length;
    const pageIdx = (pageNum - 1 + 30) % HANDWRITING_SETS[studentIdx].length;
    const hw = HANDWRITING_SETS[studentIdx][pageIdx];

    if (hw.lines.length > 0) {
      ctx.fillStyle = hw.color;
      ctx.font = '20px "Noto Sans KR", sans-serif';
      let startY = 290;
      hw.lines.forEach((line, i) => {
        // 약간의 x 흔들림으로 손글씨 느낌
        const xJitter = ((seed * 7 + i * 3) % 5) - 2;
        ctx.fillText(line, 30 + xJitter, startY + i * 42);
      });
    }
  }, [seed, studentName, pageNum]);

  return (
    <div className="w-full h-full bg-slate-50 relative overflow-hidden">
      <canvas
        ref={canvasRef}
        width={420}
        height={594}
        className="relative z-10 w-full h-full"
        style={{ objectFit: 'contain' }}
      />
    </div>
  );
};
