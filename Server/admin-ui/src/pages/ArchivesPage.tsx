import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pen, Clock, Link2, Trash2, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { archivesApi, type ArchiveInfo } from '../lib/api';
import { formatDate, formatDuration } from '../lib/utils';

function ArchiveCard({
  archive,
  onDelete,
  onRestore,
}: {
  archive: ArchiveInfo;
  onDelete: () => void;
  onRestore: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{archive.hostName}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onRestore} title="복원">
              <RotateCcw size={16} />
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete} title="삭제">
              <Trash2 size={16} className="text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Pen size={14} />
              <span>{archive.totalStrokes.toLocaleString()} 스트로크</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{archive.totalPages} 페이지</span>
            </div>
            {archive.hasLinkedPrev && (
              <div className="flex items-center gap-1 text-primary">
                <Link2 size={14} />
                <span>연결됨</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span>{formatDuration(archive.duration)}</span>
            </div>
            <span>|</span>
            <span>{formatDate(archive.createdAt)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ArchivesPage() {
  const queryClient = useQueryClient();

  const { data: archives, isLoading, error } = useQuery({
    queryKey: ['archives'],
    queryFn: archivesApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: archivesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archives'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: archivesApi.restore,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sessions'] });
      alert(`세션이 복원되었습니다. 코드: ${data.code}`);
    },
  });

  const handleDelete = (archiveId: string) => {
    if (confirm('이 아카이브를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      deleteMutation.mutate(archiveId);
    }
  };

  const handleRestore = (archiveId: string) => {
    if (confirm('이 아카이브에서 새 세션을 생성하시겠습니까?')) {
      restoreMutation.mutate(archiveId);
    }
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">아카이브 목록을 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">아카이브</h1>
        <p className="text-muted-foreground mt-1">저장된 세션 기록을 관리합니다.</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      ) : archives?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">저장된 아카이브가 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {archives?.map((archive) => (
            <ArchiveCard
              key={archive.id}
              archive={archive}
              onDelete={() => handleDelete(archive.id)}
              onRestore={() => handleRestore(archive.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
