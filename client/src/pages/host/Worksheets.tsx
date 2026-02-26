import { useState, useEffect } from 'react';

interface Worksheet {
    id: string;
    name: string;
    uploadedAt: number;
}

export default function Worksheets() {
    const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadWorksheets();
    }, []);

    const loadWorksheets = () => {
        try {
            const saved = JSON.parse(localStorage.getItem('nc_worksheets') || '[]') as Worksheet[];
            // 최신 업로드순 정렬
            const sorted = saved.sort((a, b) => b.uploadedAt - a.uploadedAt);
            setWorksheets(sorted);
        } catch (error) {
            console.error('워크시트 로드 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadNcodePDF = (worksheet: Worksheet) => {
        alert(`NCode PDF 다운로드: ${worksheet.name}\n(실제 파일 생성은 향후 구현 예정)`);
    };

    const handleDownloadNP2 = (worksheet: Worksheet) => {
        alert(`.np2 파일 다운로드: ${worksheet.name}\n(실제 파일 생성은 향후 구현 예정)`);
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    if (loading) {
        return (
            <div className="p-8">
                <div className="flex items-center justify-center h-64">
                    <p className="text-gray-500">로딩중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* 헤더 */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">내 워크시트</h1>
                <p className="text-gray-600">세션 만들기에서 업로드한 워크시트 목록입니다</p>
            </div>

            {/* 워크시트 목록 */}
            {worksheets.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm p-16 text-center">
                    <div className="mb-6">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-4xl">📄</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">워크시트가 없습니다</h3>
                        <p className="text-gray-500 text-sm">
                            세션 만들기에서 PDF를 업로드하면 여기에 저장됩니다
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {/* 테이블 헤더 */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
                        <div className="col-span-6 text-sm font-medium text-gray-700">파일명</div>
                        <div className="col-span-3 text-sm font-medium text-gray-700">업로드 일시</div>
                        <div className="col-span-3 text-sm font-medium text-gray-700 text-right">다운로드</div>
                    </div>

                    {/* 워크시트 리스트 */}
                    <div className="divide-y divide-gray-100">
                        {worksheets.map((worksheet) => (
                            <div
                                key={worksheet.id}
                                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                            >
                                {/* 파일명 */}
                                <div className="col-span-6 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <span className="text-lg">📄</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-800 truncate">{worksheet.name}</p>
                                        <p className="text-xs text-gray-500">PDF 문서</p>
                                    </div>
                                </div>

                                {/* 업로드 일시 */}
                                <div className="col-span-3 flex items-center">
                                    <p className="text-sm text-gray-600">{formatDate(worksheet.uploadedAt)}</p>
                                </div>

                                {/* 다운로드 버튼 */}
                                <div className="col-span-3 flex items-center justify-end gap-2">
                                    <button
                                        onClick={() => handleDownloadNcodePDF(worksheet)}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                        title="NCode가 포함된 PDF 다운로드"
                                    >
                                        NCode PDF
                                    </button>
                                    <button
                                        onClick={() => handleDownloadNP2(worksheet)}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                                        title="Neo smartpen 전용 .np2 파일 다운로드"
                                    >
                                        .np2
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
