import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HandwritingThumbnail } from '../components/HandwritingThumbnail';

interface ArchiveItem {
  archiveId: string;
  sessionName: string;
  participantCount: number;
  endedAt: string;
  pages: number;
}

interface Participant {
  userId: string;
  nickname: string;
  role: 'host' | 'guest';
  isMe?: boolean;
}

interface PdfOption {
  id: string;
  filename: string;
  pages: number;
  date: string;
  sobp: string;
}

const DUMMY_PARTICIPANTS: Participant[] = [
  { userId: 'host_001', nickname: '김선생', role: 'host', isMe: true },
  { userId: 'guest_001', nickname: '박민준', role: 'guest' },
  { userId: 'guest_002', nickname: '이서연', role: 'guest' },
  { userId: 'guest_003', nickname: '최도윤', role: 'guest' },
  { userId: 'guest_004', nickname: '정하은', role: 'guest' },
  { userId: 'guest_005', nickname: '강지우', role: 'guest' },
];

const DUMMY_PDFS: PdfOption[] = [
  { id: 'pdf1', filename: '고등_국어_현대시_분석_워크시트.pdf',        pages: 2, date: '2026/03/07', sobp: '5.255.0.250' },
  { id: 'pdf2', filename: '제39회_고등부_2차시험_한국수학올림피아드.pdf', pages: 3, date: '2026/03/07', sobp: '5.255.0.250' },
  { id: 'pdf3', filename: '수학_이차방정식_예제풀이.pdf',               pages: 1, date: '2026/03/07', sobp: '5.255.0.250' },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ArchiveDetailPage() {
  const { archiveId } = useParams<{ archiveId: string }>();
  const navigate = useNavigate();

  const [archive, setArchive] = useState<ArchiveItem | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<PdfOption>(DUMMY_PDFS[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nc_archives') || '[]') as ArchiveItem[];
      const found = saved.find(a => a.archiveId === archiveId);
      setArchive(found ?? null);
    } catch {
      setArchive(null);
    }
  }, [archiveId]);

  if (!archive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <p className="text-slate-400 font-bold">아카이브를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const pdfLabel = `${selectedPdf.filename} · ${selectedPdf.pages}P · ${selectedPdf.date} · SOBP: ${selectedPdf.sobp}`;

  return (
    <div className="min-h-screen bg-app-bg text-slate-800 font-noto overflow-x-hidden selection:bg-brand-primary/10">
      {/* 본문 */}
      <div className="max-w-6xl mx-auto px-10 py-16 flex flex-col gap-12 animate-in fade-in duration-700 transition-all">

        {/* ── 섹션 2: 세션 헤더 ── */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-1.5 text-slate-400 font-bold text-sm hover:text-brand-primary transition-colors w-fit group"
          >
            <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            뒤로가기
          </button>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">{archive.sessionName}</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-400">{formatDate(archive.endedAt)} · {new Date(archive.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="bg-slate-100 text-slate-500 text-[10px] font-black uppercase rounded-full px-2.5 py-0.5 tracking-widest">Archived</span>
          </div>
        </div>

        {/* ── 섹션 3: 요약 카드 3개 ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="neo-card p-6 flex flex-col gap-1 transition-transform border-b-4 border-b-brand-primary/20">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">참가자 수</span>
            <span className="text-3xl font-black text-brand-primary tracking-tighter">{archive.participantCount}명</span>
          </div>
          <div className="neo-card p-6 flex flex-col gap-1 transition-transform border-b-4 border-b-brand-secondary/20">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">진행 시간</span>
            <span className="text-3xl font-black text-brand-secondary tracking-tighter">45분</span>
          </div>
          <div className="neo-card p-6 flex flex-col gap-1 transition-transform border-b-4 border-b-amber-300/20">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">첨삭 횟수</span>
            <span className="text-3xl font-black text-amber-500 tracking-tighter">12회</span>
            <span className="text-[10px] text-slate-400 font-bold mt-1">호스트 첨삭 사용 횟수</span>
          </div>
        </div>

        {/* ── 섹션 4: PDF 선택 바 (드롭다운 기능 복구) ── */}
        <div className="neo-card p-4 flex items-center justify-between gap-4 bg-white/60 backdrop-blur-lg">
          <div className="relative flex-1 min-w-0">
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="w-full flex items-center justify-between gap-3 text-sm bg-white border border-app-border rounded-xl px-4 py-2.5 hover:bg-slate-50 transition-all text-left font-bold text-slate-700 shadow-sm"
            >
              <div className="flex items-center gap-2 truncate">
                <svg className="w-5 h-5 text-slate-300" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414L13.586 3.586A2 2 0 0012 3H9zM7 8H5a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2v-2" /></svg>
                <span className="truncate">{pdfLabel}</span>
              </div>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" strokeWidth={2.5} /></svg>
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-app-border rounded-2xl shadow-modern z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {DUMMY_PDFS.map(pdf => (
                  <button
                    key={pdf.id}
                    onClick={() => { setSelectedPdf(pdf); setDropdownOpen(false); }}
                    className={`w-full text-left px-5 py-3.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between font-medium ${
                      selectedPdf.id === pdf.id ? 'bg-brand-tint text-brand-tint-text' : 'text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="opacity-40">📄</span>
                      <span className="truncate">{pdf.filename}</span>
                    </div>
                    <span className="flex-shrink-0 text-[10px] font-black opacity-30 tracking-widest">{pdf.pages}P</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setPdfModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-app-border text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition-all shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              VIEW PDF
            </button>
            <button
              onClick={() => window.print()}
              className="neo-btn-primary !px-5 !py-2 !text-xs whitespace-nowrap shadow-sm"
            >
              🖨 PRINT ALL
            </button>
          </div>
        </div>

        {/* ── 섹션 5: 참가자 필기 그리드 ── */}
        <section className="flex flex-col gap-6">
          <h2 className="text-xl font-black text-slate-800 tracking-tighter">
            참가자 필기 <span className="text-sm font-bold opacity-30 ml-2">{DUMMY_PARTICIPANTS.length} Students</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {DUMMY_PARTICIPANTS.map((participant, idx) => (
              <button
                key={participant.userId}
                onClick={() =>
                  participant.role === 'guest'
                    ? navigate(`/replay/guest/${archiveId!}/${participant.userId}`)
                    : navigate(`/archive/${archiveId!}/student/${participant.userId}?role=host`)
                }
                className={`group relative bg-white rounded-modern overflow-hidden transition-all duration-500 text-left border-2 h-[420px] ${
                  participant.isMe ? 'border-brand-primary shadow-brand scale-[1.02]' : 'border-app-border shadow-soft'
                } hover:-translate-y-2 hover:shadow-modern`}
              >
                {participant.isMe && (
                   <span className="absolute top-4 left-4 z-20 bg-brand-primary text-white text-[10px] font-black rounded-full px-3 py-1 uppercase tracking-widest shadow-brand">
                    Me
                  </span>
                )}
                
                {/* 썸네일 영역에 새로운 HandwritingThumbnail 적용 */}
                <div className="absolute inset-x-0 top-0 bottom-[60px] bg-slate-50 transition-colors group-hover:bg-white overflow-hidden">
                   <HandwritingThumbnail seed={idx} />
                </div>
                
                <div className="absolute inset-x-0 bottom-0 h-[60px] bg-white border-t border-app-border px-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white ${participant.role === 'host' ? 'bg-brand-primary' : 'bg-slate-200'}`}>
                       {participant.nickname.charAt(0)}
                    </div>
                    <span className="text-sm font-bold text-slate-800">{participant.nickname}</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    participant.role === 'host'
                      ? 'bg-brand-tint text-brand-tint-text'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    {participant.role === 'host' ? 'Host' : 'Guest'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* PDF 미리보기 모달 (기존 구조 유지하며 스타일 업그레이드) */}
      {pdfModalOpen && (
        <div
          className="fixed inset-0 z-100 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in duration-300"
          onClick={() => setPdfModalOpen(false)}
        >
          <div
            className="neo-card p-12 max-w-sm w-full text-center space-y-6 relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-20 h-20 bg-brand-tint rounded-3xl mx-auto flex items-center justify-center text-brand-primary shadow-sm">
               <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>
            </div>
            <div>
               <p className="text-xl font-black text-slate-900 tracking-tight leading-none mb-2">{selectedPdf.filename}</p>
               <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">{selectedPdf.pages} Page Visual Preview</p>
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={() => setPdfModalOpen(false)}
                className="neo-btn-primary !w-full"
              >
                열기
              </button>
              <button
                onClick={() => setPdfModalOpen(false)}
                className="px-6 py-2 text-slate-400 font-bold hover:text-slate-600 transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
