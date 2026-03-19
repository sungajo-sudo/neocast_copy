import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HandwritingPreview } from '../components/HandwritingPreview';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-app-bg text-slate-900 min-h-screen font-noto overflow-x-hidden selection:bg-brand-primary/20">
      
      {/* ─────────────────── BACKGROUND GLOW (Visual Only) ─────────────────── */}
      <div className="fixed -top-[300px] -right-[200px] w-[800px] h-[800px] bg-brand-primary opacity-5 rounded-full blur-[160px] pointer-events-none" />
      <div className="fixed -bottom-[300px] -left-[200px] w-[700px] h-[700px] bg-brand-secondary opacity-5 rounded-full blur-[140px] pointer-events-none" />

      {/* ─────────────────── HERO SECTION ─────────────────── */}
      <main className="relative z-10 pt-[120px] pb-[100px] px-[6%] max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-[80px] items-center">
        {/* Text Section */}
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-left duration-1000">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-brand-tint rounded-full border border-brand-primary/10 shadow-sm animate-pulse-slow">
            <span className="w-2 h-2 rounded-full bg-brand-primary" />
            <span className="text-xs font-black text-brand-tint-text uppercase tracking-widest leading-none">Global Learning Standard</span>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-slate-900 text-[64px] md:text-[80px] font-black leading-[1.1] tracking-[-2px] py-1">Paper Writing.</h1>
            <h1 className="text-[64px] md:text-[80px] font-black leading-[1.1] tracking-[-2px] py-1 bg-gradient-to-br from-brand-primary to-brand-secondary bg-clip-text text-transparent">Digital Insight.</h1>
          </div>

          <p className="text-lg text-slate-500 leading-relaxed font-semibold max-w-[500px]">
            학생은 익숙한 <strong>종이</strong> 위에 문제를 풀고, <br />
            선생님은 실시간 <strong>디지털 대시보드</strong>로 한눈에 분석합니다. <br />
            아날로그 필기의 가치를 데이터로 확장하는 <strong>NeoCAST</strong>입니다.
          </p>

          <div className="flex items-center gap-5 pt-4">
             <button 
               onClick={() => navigate('/login')}
               className="neo-btn-primary hover:scale-105 active:scale-95 transition-transform"
             >
               지금 시작하기
             </button>
             <button 
               onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
               className="flex items-center gap-3 group text-brand-primary font-black hover:translate-x-1 transition-all"
             >
                <span className="border-b-2 border-brand-primary/10">View Features →</span>
             </button>
          </div>
        </div>

        {/* Preview Section (Interactive Real-Life Sync: Paper to Dashboard) */}
        <div className="relative group transition-all duration-1000 animate-in fade-in slide-in-from-right">
          <div className="relative z-20 shadow-modern rounded-[40px] overflow-hidden border-[12px] border-slate-900 bg-slate-900 aspect-[5/4]">
             <img 
               src="/images/student-hero.png" 
               alt="Student-to-Teacher Live Sync" 
               className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-1000"
             />
             
             {/* ── Interactive Handwriting Overlay (Real-time GIF Feel) ── */}
             {/* This absolute container is positioned and tilted to match the laptop screen in the image */}
             <div 
               className="absolute z-30 pointer-events-none"
               style={{
                 top: '34.5%',
                 left: '52.5%',
                 width: '28%',
                 height: '19.5%',
                 perspective: '1000px',
                 transform: 'rotateY(-24deg) rotateX(8deg) skewY(-2deg)'
               }}
             >
               <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000">
                  <HandwritingPreview isOverlay />
               </div>
             </div>

             {/* Glass Overlay UI */}
             <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/80 to-transparent flex items-end p-8">
               <div className="flex items-center gap-4 text-white">
                  <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg animate-bounce-slow">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2.5}/></svg>
                  </div>
                  <div>
                    <div className="text-xs font-black tracking-tight">Active Learning Session: Math 101</div>
                    <div className="text-[9px] text-white/50 font-bold uppercase tracking-widest leading-none">Live Paper-to-Cloud Stream</div>
                  </div>
               </div>
             </div>
          </div>
          {/* Background Decoration */}
          <div className="absolute top-[40px] -right-[40px] w-full h-full bg-brand-primary opacity-20 rounded-[40px] -z-10 blur-[100px] animate-pulse-slow" />
          <div className="absolute bottom-[40px] -left-[40px] w-full h-full bg-brand-secondary opacity-20 rounded-[40px] -z-10 blur-[100px]" style={{ animationDelay: '3s' }} />
        </div>
      </main>

      {/* ─────────────────── FEATURES SECTION (기존 ID 유지) ─────────────────── */}
      <section id="features" className="relative z-10 py-[120px] px-[6%] bg-white/40 backdrop-blur-sm border-y border-app-border">
        <div className="max-w-[1200px] mx-auto text-center">
          <div className="mb-20 space-y-4">
            <p className="text-sm font-black text-brand-primary uppercase tracking-[0.2em] opacity-80 decoration-brand-secondary underline underline-offset-8">Core Capabilities</p>
            <h2 className="text-[48px] font-black tracking-tighter text-slate-900 leading-[1.1]">Designed for Global Scalability.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { 
                title: 'Monitoring Grid', 
                desc: '최대 100명의 학생을 동시에 모니터링하세요. 고해상도 필기 재생 기능으로 단 한 명의 학습 흐름도 놓치지 않습니다.',
                icon: 'view-grid',
                color: 'brand-primary'
              },
              { 
                title: 'Smart Sync', 
                desc: 'Neo Smartpen과 완벽하게 연동됩니다. 기존의 학습 습관을 유지하면서 종이 학습지를 즉시 디지털화하세요.',
                icon: 'lightning-bolt',
                color: 'brand-secondary'
              },
              { 
                title: 'AI Analytics', 
                desc: '필기 시간과 진척도를 자동으로 분석합니다. 필기 데이터를 기반으로 실질적인 교육 인사이트를 도출해 보세요.',
                icon: 'presentation-chart-line',
                color: 'brand-primary'
              }
            ].map((f, i) => (
              <div 
                key={f.title} 
                className="neo-card p-12 flex flex-col gap-8 group hover:-translate-y-4 hover:shadow-2xl transition-all duration-500 border-b-8 border-b-transparent hover:border-b-brand-secondary bg-white"
              >
                <div className={`w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-${f.color}/10 group-hover:text-brand-primary transform group-hover:rotate-12 transition-all`}>
                   <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {i === 0 && <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />}
                      {i === 1 && <path d="M13 10V3L4 14h7v7l9-11h-7z" />}
                      {i === 2 && <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>}
                   </svg>
                </div>
                <h4 className="text-2xl font-black text-slate-800 leading-none">{f.title}</h4>
                <p className="text-slate-500 leading-relaxed font-semibold">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── FOOTER ─────────────────── */}
      <footer className="py-12 flex flex-col items-center justify-center gap-4 bg-app-bg border-t border-app-border">
         <p className="text-[11px] text-slate-300 font-black uppercase tracking-[0.3em] opacity-60">© 2025 NeoLAB Convergence. NeoCAST.</p>
      </footer>

    </div>
  );
}
