import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HardDrive, FileText, Database, Eye, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { adminApi, StatsPeriod, PaperInfo } from '../lib/api';

const periodOptions: { value: StatsPeriod; label: string }[] = [
  { value: 'cumulative', label: '누적' },
  { value: 'daily', label: '일간' },
  { value: 'weekly', label: '주간' },
  { value: 'monthly', label: '월간' },
  { value: 'yearly', label: '연간' },
];

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
}

function StatCard({ title, value, icon, description }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function StoragePage() {
  const [period, setPeriod] = useState<StatsPeriod>('cumulative');
  const [paperPage, setPaperPage] = useState(0);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const pageSize = 20;

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin', 'stats', 'storage-detailed', period],
    queryFn: () => adminApi.getStorageDetailed(period),
    refetchInterval: 30000,
  });

  const { data: papersData, isLoading: isPapersLoading } = useQuery({
    queryKey: ['admin', 'papers', paperPage],
    queryFn: () => adminApi.getPapers(pageSize, paperPage * pageSize),
    refetchInterval: 30000,
  });

  const { data: previewUrl, isLoading: isPreviewLoading } = useQuery({
    queryKey: ['admin', 'papers', previewingId, 'preview'],
    queryFn: () => adminApi.getPaperPreview(previewingId!),
    enabled: !!previewingId,
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">통계를 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  const totalPages = papersData ? Math.ceil(papersData.pagination.total / pageSize) : 0;

  const handlePreview = async (paper: PaperInfo) => {
    setPreviewingId(paper.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">스토리지</h1>
          <p className="text-muted-foreground mt-1">PDF 스토리지 현황을 확인하세요.</p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {periodOptions.map((option) => (
            <Button
              key={option.value}
              variant={period === option.value ? 'default' : 'ghost'}
              size="sm"
              className="h-8"
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="총 PDF 용량"
          value={isLoading ? '-' : stats?.totalPdfSizeFormatted ?? '0 B'}
          icon={<HardDrive size={20} />}
          description="저장된 PDF 총 용량"
        />
        <StatCard
          title="등록된 PDF 수"
          value={isLoading ? '-' : (stats?.totalPdfCount ?? 0).toLocaleString()}
          icon={<FileText size={20} />}
          description="NCode PDF 파일 수"
        />
        <StatCard
          title="평균 PDF 크기"
          value={isLoading ? '-' : stats?.averagePdfSizeFormatted ?? '0 B'}
          icon={<Database size={20} />}
          description="PDF 파일당 평균 크기"
        />
      </div>

      {/* Preview Modal */}
      {previewingId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">PDF 미리보기</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setPreviewingId(null)}>
              닫기
            </Button>
          </CardHeader>
          <CardContent>
            {isPreviewLoading ? (
              <div className="text-center py-8 text-muted-foreground">미리보기 로딩 중...</div>
            ) : previewUrl ? (
              <div className="space-y-4">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  새 탭에서 열기 <ExternalLink size={16} />
                </a>
                <iframe
                  src={previewUrl}
                  className="w-full h-[600px] border border-border rounded-lg"
                  title="PDF Preview"
                />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">미리보기를 불러올 수 없습니다.</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PDF List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText size={20} />
            등록된 PDF 목록
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPaperPage(p => Math.max(0, p - 1))}
              disabled={paperPage === 0}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm text-muted-foreground">
              {paperPage + 1} / {totalPages || 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPaperPage(p => p + 1)}
              disabled={paperPage >= totalPages - 1}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isPapersLoading ? (
            <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
          ) : !papersData?.data?.length ? (
            <div className="text-center py-8 text-muted-foreground">등록된 PDF가 없습니다</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">제목</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">소유자</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">페이지</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">용량</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">SOBP</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">등록일</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">미리보기</th>
                  </tr>
                </thead>
                <tbody>
                  {papersData.data.map((paper) => (
                    <tr key={paper.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium max-w-[200px] truncate" title={paper.title}>
                        {paper.title}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        <div className="max-w-[150px] truncate" title={paper.user.email}>
                          {paper.user.name}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">{paper.pageCount}</td>
                      <td className="py-3 px-4 text-right">{formatBytes(paper.pdfSize)}</td>
                      <td className="py-3 px-4 text-sm font-mono text-muted-foreground">
                        {paper.section}_{paper.owner}_{paper.book}_{paper.pageStart}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">
                        {formatDate(paper.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(paper)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">스토리지 정보</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>SOBP:</strong> Section_Owner_Book_PageStart - NCode PDF의 고유 좌표 정보입니다.</p>
          <p><strong>스토리지:</strong> Google Cloud Storage에 저장된 PDF 파일입니다.</p>
          <p><strong>미리보기:</strong> 서명된 URL로 PDF를 임시로 열람할 수 있습니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
