import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import watercolorBg from '../assets/images/watercolor-bg.png';

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

function BlankCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 420, 594);
  }, []);
  return (
    <canvas
      ref={canvasRef}
      width={420}
      height={594}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">아카이브를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const pdfLabel = `${selectedPdf.filename} · ${selectedPdf.pages}P · ${selectedPdf.date} · SOBP: ${selectedPdf.sobp}`;

  return (
    <div className="min-h-screen relative">
      {/* 수채화 배경 */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: `url(${watercolorBg})` }}
      />
      <div className="fixed inset-0 z-0 bg-white/40 pointer-events-none" />

      {/* ── GNB (로고/네비만) ── */}
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur-md border-b border-white/50 h-14 flex items-center px-6">
        <span className="font-bold text-gray-800 text-base tracking-tight">NeoCAST</span>
      </header>

      {/* 본문 */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* ── 섹션 2: 세션 헤더 ── */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate('/home')}
            className="text-gray-500 hover:text-gray-800 text-sm transition-colors flex items-center gap-1 w-fit"
          >
            ← 뒤로가기
          </button>
          <h1 className="font-bold text-2xl text-gray-900">{archive.sessionName}</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{formatDate(archive.endedAt)} 14:30</span>
            <span className="bg-gray-100 text-gray-500 text-xs rounded-full px-2 py-0.5">종료</span>
          </div>
        </div>

        {/* ── 섹션 3: 요약 카드 3개 ── */}
        <div className="grid grid-cols-3 gap-4">
          {/* 카드 1: 참가자 수 */}
          <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow px-5 py-4 flex flex-col gap-1">
            <span className="text-xs text-gray-500">참가자 수</span>
            <span className="font-bold text-2xl text-blue-600">{archive.participantCount}명</span>
          </div>

          {/* 카드 2: 진행 시간 */}
          <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow px-5 py-4 flex flex-col gap-1">
            <span className="text-xs text-gray-500">진행 시간</span>
            <span className="font-bold text-2xl text-purple-600">45분</span>
          </div>

          {/* 카드 3: 첨삭 횟수 */}
          <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow px-5 py-4 flex flex-col gap-1">
            <span className="text-xs text-gray-500">첨삭 횟수</span>
            <span className="font-bold text-2xl text-orange-600">12회</span>
            <span className="text-xs text-gray-400 mt-0.5">호스트 첨삭 사용 횟수</span>
          </div>
        </div>

        {/* ── 섹션 4: PDF 선택 바 ── */}
        <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow px-4 py-3 flex items-center justify-between gap-4">
          {/* 드롭다운 */}
          <div className="relative flex-1 min-w-0">
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="w-full flex items-center justify-between gap-2 text-sm bg-white/70 border border-gray-200 rounded-xl px-3 py-2 hover:bg-white transition-colors text-left"
            >
              <span className="truncate text-gray-700">{pdfLabel}</span>
              <span className="text-gray-400 flex-shrink-0 text-xs">{dropdownOpen ? '▲' : '▼'}</span>
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                {DUMMY_PDFS.map(pdf => (
                  <button
                    key={pdf.id}
                    onClick={() => { setSelectedPdf(pdf); setDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 ${
                      selectedPdf.id === pdf.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <span className="flex-shrink-0">📄</span>
                    <span className="truncate">{pdf.filename}</span>
                    <span className="flex-shrink-0 text-xs text-gray-400">{pdf.pages}P</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setPdfModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              👁 보기
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              🖨 인쇄
            </button>
          </div>
        </div>

        {/* ── 섹션 5: 참가자 필기 그리드 ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-600">
            참가자 필기 ({DUMMY_PARTICIPANTS.length}명)
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {DUMMY_PARTICIPANTS.map(participant => (
              <button
                key={participant.userId}
                onClick={() => navigate(`/archive/${archiveId!}/student/${participant.userId}?role=${participant.role}`)}
                className={`relative bg-white/80 backdrop-blur-md rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:scale-[1.02] transition-all text-left ${
                  participant.isMe ? 'border-2 border-blue-500' : 'border border-white/60'
                }`}
              >
                {participant.isMe && (
                  <span className="absolute top-2 left-2 z-10 bg-blue-500 text-white text-xs font-medium rounded-full px-2 py-0.5">
                    나
                  </span>
                )}
                <div style={{ aspectRatio: '420/594' }} className="overflow-hidden">
                  <BlankCanvas />
                </div>
                <div className="px-3 py-2 flex items-center justify-between gap-1">
                  <span className="text-sm font-medium text-gray-800 truncate">{participant.nickname}</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 flex-shrink-0 ${
                    participant.role === 'host'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {participant.role === 'host' ? '호스트' : '게스트'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* PDF 미리보기 모달 */}
      {pdfModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPdfModalOpen(false)}
        >
          <div
            className="bg-white/90 backdrop-blur-xl rounded-3xl border border-white/60 shadow-2xl p-8 max-w-sm w-full text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-4xl mb-4">📄</div>
            <p className="font-semibold text-gray-800 mb-1">{selectedPdf.filename}</p>
            <p className="text-sm text-gray-500 mb-6">{selectedPdf.pages}페이지 · PDF 미리보기</p>
            <button
              onClick={() => setPdfModalOpen(false)}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
