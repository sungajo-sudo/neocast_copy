import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Paperclip, HardDrive, Users, MessageCircle, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { adminApi, StatsPeriod } from '../lib/api';

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

export default function ChatStatsPage() {
  const [period, setPeriod] = useState<StatsPeriod>('cumulative');

  const { data: chatStats, isLoading: isChatLoading, error: chatError } = useQuery({
    queryKey: ['admin', 'stats', 'chat', period],
    queryFn: () => adminApi.getChatStats(period),
    refetchInterval: 30000,
  });

  const { data: messengerStats, isLoading: isMessengerLoading, error: messengerError } = useQuery({
    queryKey: ['admin', 'stats', 'messenger', period],
    queryFn: () => adminApi.getMessengerStats(period),
    refetchInterval: 30000,
  });

  if (chatError || messengerError) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">통계를 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  const isLoading = isChatLoading || isMessengerLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">채팅/메신저 통계</h1>
          <p className="text-muted-foreground mt-1">채팅 및 메신저 활동 현황을 확인하세요.</p>
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

      {/* Session Chat Stats */}
      <div>
        <h2 className="text-xl font-semibold mb-4">세션 채팅</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="채팅 메시지 수"
            value={isLoading ? '-' : (chatStats?.messageCount ?? 0).toLocaleString()}
            icon={<MessageSquare size={20} />}
            description="세션 내 채팅 메시지"
          />
          <StatCard
            title="첨부파일 수"
            value={isLoading ? '-' : (chatStats?.attachmentCount ?? 0).toLocaleString()}
            icon={<Paperclip size={20} />}
            description="공유된 파일 수"
          />
          <StatCard
            title="첨부파일 용량"
            value={isLoading ? '-' : chatStats?.attachmentStorageFormatted ?? '0 B'}
            icon={<HardDrive size={20} />}
            description="첨부파일 스토리지 사용량"
          />
        </div>
      </div>

      {/* Messenger Stats */}
      <div>
        <h2 className="text-xl font-semibold mb-4">메신저 (DM)</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="DM 메시지 수"
            value={isLoading ? '-' : (messengerStats?.dmMessageCount ?? 0).toLocaleString()}
            icon={<MessageCircle size={20} />}
            description="1:1 다이렉트 메시지"
          />
          <StatCard
            title="활성 대화방"
            value={isLoading ? '-' : (messengerStats?.activeThreads ?? 0).toLocaleString()}
            icon={<Users size={20} />}
            description="활성화된 DM 스레드"
          />
          <StatCard
            title="친구 관계"
            value={isLoading ? '-' : (messengerStats?.totalFriendships ?? 0).toLocaleString()}
            icon={<UserPlus size={20} />}
            description="등록된 친구 관계 수"
          />
        </div>
      </div>

      {/* Detailed Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">상세 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-medium">세션 채팅</h3>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">첨부파일 용량 (bytes)</p>
                <p className="text-lg font-medium">
                  {isLoading ? '-' : (chatStats?.attachmentStorageBytes ?? 0).toLocaleString()} bytes
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-medium">메신저</h3>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">조회 기간</p>
                <p className="text-lg font-medium">
                  {periodOptions.find(p => p.value === period)?.label}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">통계 설명</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>세션 채팅:</strong> 세션 내에서 참가자들이 주고받은 채팅 메시지입니다.</p>
          <p><strong>메신저:</strong> 친구 간 1:1 다이렉트 메시지 통계입니다.</p>
          <p><strong>친구 관계:</strong> 사용자 간 등록된 친구 관계 수입니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
