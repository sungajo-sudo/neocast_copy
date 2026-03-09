import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import CreateSessionModal from '../../components/modals/CreateSessionModal';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).href;

interface WorksheetMeta {
    pageCount: number;
    name: string;
    uploadedAt: number;
}

interface WorksheetCard {
    id: string;
    meta: WorksheetMeta;
    thumbnail: string | null;
}

export default function Worksheets() {
    const [cards, setCards] = useState<WorksheetCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [sessionModalOpen, setSessionModalOpen] = useState(false);
    const [selectedWorksheetId, setSelectedWorksheetId] = useState<string | undefined>(undefined);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadCards();
    }, []);

    const loadCards = () => {
        try {
            const keys = Object.keys(localStorage).filter(k => k.startsWith('nc_ws_meta_'));
            const loaded: WorksheetCard[] = keys.map(key => {
                const id = key.replace('nc_ws_meta_', '');
                const meta = JSON.parse(localStorage.getItem(key) || '{}') as WorksheetMeta;
                const thumbnail = localStorage.getItem(`nc_ws_thumb_${id}`);
                return { id, meta, thumbnail };
            });
            loaded.sort((a, b) => b.meta.uploadedAt - a.meta.uploadedAt);
            setCards(loaded);
        } catch (e) {
            console.error('워크시트 로드 실패:', e);
        } finally {
            setLoading(false);
        }
    };

    const fileToBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const processPDF = async (file: File) => {
        if (file.type !== 'application/pdf') {
            alert('PDF 파일만 업로드 가능합니다.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert('파일 크기는 10MB 이하만 허용됩니다.');
            return;
        }

        setUploading(true);
        try {
            const arrayBuffer = await file.arrayBuffer();

            // PDF 로드 및 페이지 수 확인
            const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const pageCount = pdfDoc.numPages;

            // 1페이지 썸네일 생성
            const page = await pdfDoc.getPage(1);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d')!;
            await page.render({ canvasContext: ctx, viewport, canvas }).promise;
            const thumbnail = canvas.toDataURL('image/jpeg', 0.7);

            // PDF 원본 base64 저장
            const base64 = await fileToBase64(file);

            const id = `ws-${Date.now()}`;
            const meta: WorksheetMeta = { pageCount, name: file.name, uploadedAt: Date.now() };

            localStorage.setItem(`nc_ws_meta_${id}`, JSON.stringify(meta));
            localStorage.setItem(`nc_ws_thumb_${id}`, thumbnail);
            localStorage.setItem(`nc_ws_pdf_${id}`, base64);

            // nc_worksheets (기존 호환) 에도 저장
            const existing = JSON.parse(localStorage.getItem('nc_worksheets') || '[]');
            existing.push({ id, name: file.name, uploadedAt: Date.now() });
            localStorage.setItem('nc_worksheets', JSON.stringify(existing));

            loadCards();
        } catch (e) {
            console.error('PDF 처리 실패:', e);
            alert('PDF 처리 중 오류가 발생했습니다.');
        } finally {
            setUploading(false);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processPDF(file);
        e.target.value = '';
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processPDF(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDelete = (id: string) => {
        if (!confirm('이 워크시트를 삭제하시겠습니까?')) return;
        localStorage.removeItem(`nc_ws_meta_${id}`);
        localStorage.removeItem(`nc_ws_thumb_${id}`);
        localStorage.removeItem(`nc_ws_pdf_${id}`);
        const existing = JSON.parse(localStorage.getItem('nc_worksheets') || '[]');
        localStorage.setItem(
            'nc_worksheets',
            JSON.stringify(existing.filter((w: { id: string }) => w.id !== id))
        );
        loadCards();
        setOpenMenuId(null);
    };

    const handleStartSession = (id: string) => {
        setSelectedWorksheetId(id);
        setSessionModalOpen(true);
    };

    const handleModalClose = () => {
        setSessionModalOpen(false);
        setSelectedWorksheetId(undefined);
    };

    const formatDate = (ts: number) =>
        new Date(ts).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center h-64">
                <p className="text-gray-500">로딩중...</p>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* 숨김 파일 입력 */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileInputChange}
            />

            {/* 헤더 */}
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-gray-800">워크시트</h1>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                    <span className="text-xl">+</span>
                    {uploading ? '처리 중...' : 'PDF 업로드'}
                </button>
            </div>

            {cards.length === 0 ? (
                /* 빈 상태 — 드래그앤드롭 영역 */
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-20 text-center cursor-pointer transition-colors ${
                        isDragging
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                    }`}
                >
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">📄</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                        {isDragging ? 'PDF를 여기에 놓으세요' : 'PDF를 업로드하세요'}
                    </h3>
                    <p className="text-gray-500 text-sm">
                        클릭하거나 파일을 드래그해서 업로드 · 최대 10MB
                    </p>
                    {uploading && (
                        <p className="text-blue-600 text-sm font-medium mt-4">처리 중...</p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map((card) => (
                        <div
                            key={card.id}
                            className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                        >
                            {/* 썸네일 */}
                            <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center overflow-hidden">
                                {card.thumbnail ? (
                                    <img
                                        src={card.thumbnail}
                                        alt={card.meta.name}
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <span className="text-5xl">📄</span>
                                )}
                            </div>

                            {/* 파일 정보 */}
                            <div className="px-4 pt-4 pb-2 border-t border-gray-100">
                                <p className="font-medium text-gray-800 truncate mb-1" title={card.meta.name}>
                                    {card.meta.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {card.meta.pageCount}페이지 · {formatDate(card.meta.uploadedAt)}
                                </p>
                            </div>

                            {/* 액션 버튼 */}
                            <div className="px-4 pb-4 space-y-2">
                                {/* 세션 시작 */}
                                <button
                                    onClick={() => handleStartSession(card.id)}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    세션 시작
                                </button>
                                {/* 다운로드 + 더보기 */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => alert(`NCode PDF 다운로드: ${card.meta.name}\n(실제 파일 생성은 향후 구현 예정)`)}
                                        className="flex-1 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium rounded-lg transition-colors"
                                        title="NCode가 포함된 PDF 다운로드"
                                    >
                                        NCode PDF
                                    </button>
                                    <button
                                        onClick={() => alert(`.np2 파일 다운로드: ${card.meta.name}\n(실제 파일 생성은 향후 구현 예정)`)}
                                        className="flex-1 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-medium rounded-lg transition-colors"
                                        title="Neo smartpen 전용 .np2 파일 다운로드"
                                    >
                                        .np2
                                    </button>
                                    <div className="relative">
                                        <button
                                            onClick={() => setOpenMenuId(openMenuId === card.id ? null : card.id)}
                                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            ···
                                        </button>
                                        {openMenuId === card.id && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                                <div className="absolute right-0 bottom-10 w-28 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                                    <button
                                                        onClick={() => handleDelete(card.id)}
                                                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* 추가 업로드 카드 */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl flex items-center justify-center cursor-pointer transition-colors min-h-[200px] ${
                            isDragging
                                ? 'border-blue-400 bg-blue-50'
                                : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50/30'
                        }`}
                    >
                        <div className="text-center p-8">
                            <div className="text-4xl mb-2 text-gray-400">+</div>
                            <p className="text-sm text-gray-500">PDF 업로드</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 세션 시작 모달 */}
            <CreateSessionModal
                isOpen={sessionModalOpen}
                onClose={handleModalClose}
                onSuccess={handleModalClose}
                initialWorksheetId={selectedWorksheetId}
            />
        </div>
    );
}
