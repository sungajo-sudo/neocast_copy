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
    color: 'from-violet-500 to-indigo-500',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
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

export function LandingPage() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-app-bg font-sans">
      {/* ═══ HERO 섹션 ═══ */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50/60 via-white to-purple-50/40 -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-violet-50 border border-violet-100 mb-6 group cursor-default shadow-sm">
              <span className="w-2 h-2 rounded-full bg-violet-500 mr-2 animate-pulse"></span>
              <span className="text-xs font-semibold text-violet-600 tracking-wider uppercase">Next Gen Education</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.15] tracking-tight">
              손글씨로 이어지는
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600">실시간 교육의 혁신</span>
            </h1>

            <p className="mt-8 text-lg sm:text-xl text-slate-500 leading-relaxed">
              멀리 떨어져 있어도 종이 위의 펜 끝이 실시간으로 연결됩니다.
              <br />
              <span className="text-slate-700">지연 시간 걱정 없는 실시간 필기 공유, NeoCAST와 함께라면 가능합니다.</span>
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={handleStart} className="neo-btn-primary w-full sm:w-auto px-8 py-4 text-lg shadow-xl shadow-violet-200 hover:scale-105 active:scale-95">
                지금 무료로 시작하기
              </button>
              <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="neo-btn-ghost w-full sm:w-auto px-8 py-4 text-lg">
                서비스 가이드 보기
              </button>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-[48px] blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>

            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* 왼쪽: 학생의 필기 */}
              <div className="lg:col-span-5 relative group/hand">
                <div className="h-full min-h-[460px] rounded-[40px] overflow-hidden shadow-2xl border border-white/50 relative bg-violet-50/30">
                  <div className="w-full h-full overflow-hidden">
                    <img
                      src="/images/student-hero.png"
                      alt="종이 위 필기에 집중하는 펜 끝"
                      className="w-full h-full object-cover scale-[1.5] sm:scale-[1.7] origin-bottom translate-y-[2%] transition-transform duration-700 group-hover/hand:scale-[1.6] sm:group-hover/hand:scale-[1.8]"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    {/* 이미지 로드 실패 시 fallback */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-violet-50/80 text-violet-400">
                      <svg className="w-16 h-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span className="text-sm font-semibold">Real-Ink Sync</span>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-violet-900/5 mix-blend-multiply"></div>

                  <div className="absolute top-8 left-8 flex items-center gap-2.5 px-5 py-2.5 bg-white/95 backdrop-blur-md rounded-[20px] shadow-xl border border-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse"></span>
                    <span className="text-[11px] font-bold text-slate-800 tracking-widest uppercase">Real-Ink Sync</span>
                  </div>
                </div>
              </div>

              {/* 중앙 데이터 브릿지 */}
              <div className="hidden lg:flex lg:col-span-1 flex-col items-center justify-center relative">
                <div className="w-12 h-12 rounded-full bg-violet-600 shadow-xl flex items-center justify-center border-4 border-white z-20">
                  <svg className="w-6 h-6 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              {/* 오른쪽: 하이브리드 대시보드 */}
              {/* 오른쪽: 네오캐스트 대형 모니터링 뷰 (단일 대시보드 강점 피드백 반영) */}
              <div className="lg:col-span-6">
                <div className="h-full bg-slate-50/50 p-2 rounded-[36px] shadow-2xl border border-white overflow-hidden">
                  <div className="h-full bg-white rounded-[30px] overflow-hidden flex flex-col">
                    <div className="h-10 bg-slate-50/80 px-5 flex items-center border-b border-slate-100 justify-between">
                      <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">NeoCAST Monitor Console</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                        <span className="text-[10px] font-medium text-slate-400 tracking-wider">SYNCED AT 0.5s</span>
                      </div>
                    </div>
                    
                    {/* 대형 필기 뷰 (단일 화면의 시각적 임팩트) */}
                    <div className="flex-1 bg-white p-10 flex flex-col items-center justify-center relative overflow-hidden">
                      {/* 배경 모눈종이 패턴 */}
                      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-40"></div>
                      
                      <div className="relative w-full max-w-lg aspect-[4/3] bg-white rounded-3xl shadow-[0_20px_50px_rgba(124,58,237,0.12)] border border-violet-100 p-12 flex flex-col items-center justify-center gap-10 group/screen">
                         <div className="absolute top-6 left-6 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-xs">SM</div>
                            <div className="flex flex-col">
                               <span className="text-[11px] font-bold text-slate-800 leading-none">최민준 학생</span>
                               <span className="text-[10px] font-medium text-violet-500 mt-1 uppercase">Math Session Active</span>
                            </div>
                         </div>

                         {/* 대형 필기 애니메이션: 마법 같은 동기화 */}
                         <div className="w-full flex items-center justify-center">
                            <svg className="w-full max-w-[320px] drop-shadow-[0_10px_20px_rgba(124,58,237,0.2)]" viewBox="0 0 120 80">
                                <path 
                                  d="M20 20 L40 20 L30 40 L40 60 L20 60 M45 30 L60 30 M45 50 L60 50" 
                                  fill="none" stroke="#7c3aed" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" 
                                  className="animate-draw-handwriting" 
                                  style={{ strokeDasharray: 200, strokeDashoffset: 200 }}
                                />
                                <text x="75" y="48" className="text-[20px] font-serif italic fill-violet-700 font-extrabold tracking-tighter">f(x)</text>
                                <circle cx="40" cy="62" r="3" fill="#7c3aed" className="animate-ping" />
                            </svg>
                         </div>

                         <div className="absolute bottom-6 right-6 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                             <span className="text-[10px] font-medium text-slate-400">SESSION RECORDING...</span>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3개 통계 배지 */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] sm:w-auto bg-white/95 backdrop-blur-xl border border-slate-200 rounded-[24px] sm:rounded-[32px] px-4 sm:px-12 py-4 sm:py-6 shadow-2xl flex items-center justify-center gap-4 sm:gap-12">
              <div className="text-center border-r border-slate-100 pr-4 sm:pr-12">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Status</p>
                <p className="text-lg sm:text-2xl font-extrabold text-violet-600 tracking-tighter">REAL-TIME</p>
              </div>
              <div className="text-center border-r border-slate-100 pr-4 sm:pr-12">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Stability</p>
                <p className="text-lg sm:text-2xl font-extrabold text-emerald-600 tracking-tighter">99.9%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Classes</p>
                <p className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tighter">1:N 30+</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 학습 사이클 ── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-4 sm:px-6 pt-32 sm:pt-40 pb-24 sm:pb-32">
        <div className="text-center mb-16">
          <span className="neo-tag">Holistic Learning Loop</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-4 tracking-tight">사고의 흐름을 데이터로 잇는 배움의 사이클</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CYCLE_STEPS.map((step, idx) => (
            <div key={idx} className="bg-white border border-slate-100 rounded-[32px] p-8 hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 ease-out">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white mb-6`}>{step.icon}</div>
              <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-widest block mb-1">{step.step}</span>
              <h3 className="text-xl font-bold text-slate-900 mb-4">{step.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-5">{step.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {step.tags.map(tag => (
                  <span key={tag} className={`text-[10px] font-semibold ${step.bgColor} ${step.textColor} px-2.5 py-1 rounded-full`}>{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 핵심 가치 ── */}
      <section className="bg-slate-50/50 py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="lg:w-1/3">
              <span className="neo-tag">Core Value</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-4 leading-tight tracking-tight">준비물은 오직 익숙한 종이와 펜</h2>
              <p className="mt-6 text-slate-500 leading-relaxed">값비싼 장비나 교실 환경에 구애받지 마세요. 익숙한 종이의 집중력을 디지털로 연결합니다.</p>
            </div>
            <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CORE_VALUES.map((v, i) => (
                <div key={i} className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex items-start gap-3 hover:border-violet-200 hover:shadow-md transition-all duration-200 ease-out">
                  <div className="text-violet-600 p-2 bg-violet-50 rounded-xl shrink-0">{v.icon}</div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm mb-1">{v.title}</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">{v.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-4xl mx-auto px-4 py-24 sm:py-32">
        <div className="bg-gradient-to-br from-violet-600 to-violet-700 rounded-[48px] p-12 sm:p-20 text-center shadow-2xl relative overflow-hidden">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">사고의 궤적을 실시간 데이터로</h2>
          <p className="text-violet-100 text-lg sm:text-xl mb-12 opacity-90">필기 속에 숨겨진 성장의 실마리를 NeoCAST로 찾아보세요.</p>
          <button onClick={handleStart} className="bg-white text-violet-600 px-12 py-5 rounded-[var(--radius-pill)] font-bold text-xl hover:bg-violet-50 hover:scale-105 active:scale-95 transition-all shadow-lg">지금 시작하기</button>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-1.5 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-300">
            <span className="text-2xl font-bold tracking-tighter text-slate-800">Neo</span>
            <span className="text-2xl font-bold tracking-tighter text-violet-600">CAST</span>
          </div>
          <div className="text-right text-slate-400">
            <p className="text-[10px] font-semibold tracking-widest">NEO.LAB CONVERGENCE INC.</p>
            <p className="text-[10px] tracking-tight mt-1">info@neolab.co.jp</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
