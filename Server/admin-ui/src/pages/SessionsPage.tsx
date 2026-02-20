import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Pen, Clock, XCircle, User, Crown, Search, X, RefreshCw, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../components/ui/Dialog';
import { adminApi, type SessionInfo, type AdminSessionDetail } from '../lib/api';
import { formatDate } from '../lib/utils';

const statusLabels: Record<string, string> = {
  ACTIVE: '진행 중',
  PAUSED: '일시 정지',
  CLOSED: '종료됨',
  ARCHIVED: '아카이브됨',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-500',
  PAUSED: 'bg-yellow-500',
  CLOSED: 'bg-gray-500',
  ARCHIVED: 'bg-blue-500',
};

function SessionCard({ session, onClose }: { session: SessionInfo; onClose: () => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-mono">{session.code}</CardTitle>
            <span
              className={`px-2 py-0.5 text-xs font-medium text-white rounded-full ${
                statusColors[session.status]
              }`}
            >
              {statusLabels[session.status]}
            </span>
          </div>
          {session.status === 'ACTIVE' && (
            <Button variant="outline" size="sm" onClick={onClose}>
              <XCircle size={16} className="mr-1" />
              세션 종료
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session.hostName}</p>
              <p className="text-xs text-muted-foreground truncate">{session.hostEmail}</p>
            </div>
            {!session.isHostOnline && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs" title="호스트 오프라인">
                <WifiOff size={12} />
                <span className="hidden sm:inline">오프라인</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users size={14} />
              <span>{session.participantCount}명</span>
            </div>
            <div className="flex items-center gap-1">
              <Pen size={14} />
              <span>{session.strokeCount.toLocaleString()} 스트로크</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span>{formatDate(session.createdAt)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const REFRESH_INTERVAL = 5000; // 5 seconds

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const [closeDialogSession, setCloseDialogSession] = useState<SessionInfo | null>(null);
  const [sessionDetail, setSessionDetail] = useState<AdminSessionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [progress, setProgress] = useState(0);

  const { data: sessions, isLoading, error, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'sessions'],
    queryFn: adminApi.getSessions,
    refetchInterval: REFRESH_INTERVAL,
  });

  // Progress bar animation
  useEffect(() => {
    if (!dataUpdatedAt) return;

    const updateProgress = () => {
      const elapsed = Date.now() - dataUpdatedAt;
      const newProgress = Math.min((elapsed / REFRESH_INTERVAL) * 100, 100);
      setProgress(newProgress);
    };

    updateProgress();
    const interval = setInterval(updateProgress, 50);
    return () => clearInterval(interval);
  }, [dataUpdatedAt]);

  const handleRefreshNow = useCallback(() => {
    setProgress(0);
    refetch();
  }, [refetch]);

  // 필터링된 세션 목록
  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    if (!filterText.trim()) return sessions;

    const searchText = filterText.toLowerCase().trim();
    return sessions.filter((session) =>
      session.code.toLowerCase().includes(searchText) ||
      session.hostName.toLowerCase().includes(searchText) ||
      session.hostEmail.toLowerCase().includes(searchText)
    );
  }, [sessions, filterText]);

  const closeMutation = useMutation({
    mutationFn: adminApi.closeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      setCloseDialogSession(null);
      setSessionDetail(null);
    },
  });

  const handleOpenCloseDialog = async (session: SessionInfo) => {
    setCloseDialogSession(session);
    setIsLoadingDetail(true);
    try {
      const detail = await adminApi.getSession(session.id);
      setSessionDetail(detail);
    } catch (err) {
      console.error('Failed to fetch session detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleCloseDialog = () => {
    setCloseDialogSession(null);
    setSessionDetail(null);
  };

  const handleConfirmClose = () => {
    if (closeDialogSession) {
      closeMutation.mutate(closeDialogSession.id);
    }
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">세션 목록을 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  const activeSessions = filteredSessions.filter((s) => s.status === 'ACTIVE');
  const otherSessions = filteredSessions.filter((s) => s.status !== 'ACTIVE');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">활성 세션</h1>
          <p className="text-muted-foreground mt-1">현재 진행 중인 세션을 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="세션 코드, 호스트 이름/이메일로 검색..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-9 pr-9"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleRefreshNow}
            disabled={isFetching}
            className="relative h-10 px-3 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 overflow-hidden"
          >
            <div
              className="absolute inset-0 bg-primary/10 transition-none"
              style={{ width: `${progress}%` }}
            />
            <div className="relative flex items-center gap-1.5">
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </div>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      ) : sessions?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">활성 세션이 없습니다.</p>
          </CardContent>
        </Card>
      ) : filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              "{filterText}" 검색 결과가 없습니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeSessions.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-green-600">
                진행 중 ({activeSessions.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onClose={() => handleOpenCloseDialog(session)}
                  />
                ))}
              </div>
            </div>
          )}

          {otherSessions.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-muted-foreground">
                기타 ({otherSessions.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {otherSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onClose={() => handleOpenCloseDialog(session)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 세션 종료 확인 다이얼로그 */}
      <Dialog open={!!closeDialogSession} onClose={handleCloseDialog}>
        <DialogHeader>
          <DialogTitle>
            세션 종료 - {closeDialogSession?.code}
          </DialogTitle>
        </DialogHeader>
        <DialogContent>
          {isLoadingDetail ? (
            <div className="text-center py-4 text-muted-foreground">로딩 중...</div>
          ) : sessionDetail ? (
            <div className="space-y-4">
              <p className="text-sm font-medium">다음과 같은 참가자들이 있습니다:</p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {sessionDetail.participants
                  .filter((p) => !p.leftAt)
                  .map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
                    >
                      <div className="flex-shrink-0">
                        {participant.role === 'HOST' ? (
                          <Crown className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <User className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{participant.user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{participant.user.email}</p>
                      </div>
                      <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-muted">
                        {participant.role === 'HOST' ? '호스트' : '게스트'}
                      </span>
                    </div>
                  ))}
                {sessionDetail.participants.filter((p) => !p.leftAt).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    현재 접속 중인 참가자가 없습니다.
                  </p>
                )}
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-center font-medium text-destructive">
                  세션을 종료하시겠습니까?
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              세션 정보를 불러올 수 없습니다.
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={handleCloseDialog} autoFocus>
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmClose}
            disabled={closeMutation.isPending || isLoadingDetail}
          >
            {closeMutation.isPending ? '종료 중...' : '세션 종료'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
