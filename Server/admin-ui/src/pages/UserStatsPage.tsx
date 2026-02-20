import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, LogIn, Clock, Activity } from 'lucide-react';
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

export default function UserStatsPage() {
  const [period, setPeriod] = useState<StatsPeriod>('cumulative');

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin', 'stats', 'users', period],
    queryFn: () => adminApi.getUserStats(period),
    refetchInterval: 30000,
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">통계를 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">이용자 통계</h1>
          <p className="text-muted-foreground mt-1">사용자 등록 및 활동 현황을 확인하세요.</p>
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="등록자 수"
          value={isLoading ? '-' : (stats?.registeredUsers ?? 0).toLocaleString()}
          icon={<Users size={20} />}
          description={`${periodOptions.find(p => p.value === period)?.label} 등록된 사용자`}
        />
        <StatCard
          title="로그인 횟수"
          value={isLoading ? '-' : (stats?.loginCount ?? 0).toLocaleString()}
          icon={<LogIn size={20} />}
          description="세션 참여 기반 집계"
        />
        <StatCard
          title="평균 세션 시간"
          value={isLoading ? '-' : stats?.averageSessionDurationFormatted ?? '0분'}
          icon={<Clock size={20} />}
          description="참여자 평균 세션 시간"
        />
        <StatCard
          title="사용 지속 시간"
          value={isLoading ? '-' : stats?.averageSessionDurationFormatted ?? '0분'}
          icon={<Activity size={20} />}
          description="평균 접속 유지 시간"
        />
      </div>

      {/* Detailed Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">상세 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground mb-1">조회 기간</p>
              <p className="text-lg font-medium">{periodOptions.find(p => p.value === period)?.label}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground mb-1">평균 세션 시간 (초)</p>
              <p className="text-lg font-medium">
                {isLoading ? '-' : Math.round(stats?.averageSessionDuration ?? 0).toLocaleString()}초
              </p>
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
          <p><strong>등록자 수:</strong> 해당 기간 동안 새로 가입한 사용자 수입니다.</p>
          <p><strong>로그인 횟수:</strong> 세션에 참여한 총 횟수를 기반으로 집계됩니다.</p>
          <p><strong>평균 세션 시간:</strong> 참여자가 세션에 접속해 있는 평균 시간입니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
