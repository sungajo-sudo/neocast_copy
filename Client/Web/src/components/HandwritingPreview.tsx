import React, { useEffect, useRef } from 'react';

export const HandwritingPreview: React.FC<{ isOverlay?: boolean }> = ({ isOverlay = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let strokeIndex = 0;
    let pointIndex = 0;
    
    // 수학 수식 스트로크 데이터 (f(x) = x^2 + 1)
    const mathStrokes = [
      [[60, 60], [58, 70], [55, 90], [58, 100], [65, 105]],
      [[50, 80], [75, 80]], 
      [[85, 65], [80, 80], [85, 95]],
      [[95, 75], [115, 95]],
      [[115, 75], [95, 95]],
      [[125, 65], [130, 80], [125, 95]],
      [[145, 78], [170, 78]],
      [[145, 87], [170, 87]],
      [[190, 75], [210, 95]],
      [[210, 75], [190, 95]],
      [[215, 65], [225, 65], [225, 70], [215, 80], [225, 80]],
      [[240, 70], [240, 90]],
      [[230, 80], [250, 80]],
      [[265, 65], [265, 95]]
    ];

    const draw = () => {
      if (!ctx || !canvas) return;

      if (strokeIndex >= mathStrokes.length) {
        setTimeout(() => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          strokeIndex = 0;
          pointIndex = 0;
          requestAnimationFrame(draw);
        }, 3000);
        return;
      }

      const currentStroke = mathStrokes[strokeIndex];
      ctx.strokeStyle = '#4f46e5'; 
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (pointIndex < currentStroke.length - 1) {
        const [p1x, p1y] = currentStroke[pointIndex];
        const [p2x, p2y] = currentStroke[pointIndex + 1];
        
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.stroke();
        
        pointIndex++;
        setTimeout(() => {
          animationFrameId = requestAnimationFrame(draw);
        }, 40); 
      } else {
        strokeIndex++;
        pointIndex = 0;
        setTimeout(() => {
          animationFrameId = requestAnimationFrame(draw);
        }, 200); 
      }
    };

    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  if (isOverlay) {
    return (
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={220} 
        className="w-full h-full pointer-events-none drop-shadow-sm"
      />
    );
  }

  return (
    <div className="relative w-full max-w-[500px] h-[340px] bg-white rounded-modern border border-app-border shadow-modern p-8 overflow-hidden">
      <div className="flex justify-between items-center mb-10">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-100" />
          <div className="w-2.5 h-2.5 rounded-full bg-slate-100" />
          <div className="w-2.5 h-2.5 rounded-full bg-slate-100" />
        </div>
        <div className="px-3 py-1 bg-brand-tint rounded-full">
           <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest">Global Math Class</span>
        </div>
      </div>

      <div className="relative h-[180px] bg-slate-50/50 rounded-2xl border border-slate-100 mb-6">
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px'}} />
        <canvas 
          ref={canvasRef} 
          width={400} 
          height={180} 
          className="relative z-10 w-full h-full"
        />
      </div>

      <div className="absolute bottom-6 left-8 right-8 flex items-center justify-between text-[#94a3b8]">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
               <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
            </div>
            <span className="text-[11px] font-bold">Neo Smartpen M1+ Syncing</span>
         </div>
         <span className="text-[11px] font-black uppercase tracking-widest opacity-40">Page 12 / 48</span>
      </div>
    </div>
  );
};
