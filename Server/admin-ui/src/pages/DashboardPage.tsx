import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Pen, Archive, Activity } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { adminApi, TimeseriesRange } from '../lib/api';

const rangeOptions: { value: TimeseriesRange; label: string }[] = [
  { value: '24h', label: '최근 24시간' },
  { value: '7d', label: '최근 7일' },
  { value: '30d', label: '최근 30일' },
  { value: '12m', label: '최근 1년' },
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

export default function DashboardPage() {
  const [sessionRange, setSessionRange] = useState<TimeseriesRange>('24h');
  const [strokeRange, setStrokeRange] = useState<TimeseriesRange>('24h');

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.getStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: sessionChartData = [], isLoading: isSessionChartLoading } = useQuery({
    queryKey: ['admin', 'timeseries', 'sessions', sessionRange],
    queryFn: () => adminApi.getTimeseries(sessionRange),
    refetchInterval: 30000,
  });

  const { data: strokeChartData = [], isLoading: isStrokeChartLoading } = useQuery({
    queryKey: ['admin', 'timeseries', 'strokes', strokeRange],
    queryFn: () => adminApi.getTimeseries(strokeRange),
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
      <div>
        <h1 className="text-3xl font-bold">대시보드</h1>
        <p className="text-muted-foreground mt-1">PenStream 서버 현황을 확인하세요.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="활성 세션"
          value={isLoading ? '-' : stats?.activeSessions ?? 0}
          icon={<Activity size={20} />}
          description="현재 진행 중인 세션"
        />
        <StatCard
          title="활성 참가자"
          value={isLoading ? '-' : stats?.activeParticipants ?? 0}
          icon={<Users size={20} />}
          description="현재 연결된 사용자"
        />
        <StatCard
          title="총 스트로크"
          value={isLoading ? '-' : (stats?.totalStrokes ?? 0).toLocaleString()}
          icon={<Pen size={20} />}
          description="기록된 필기 데이터"
        />
        <StatCard
          title="아카이브"
          value={isLoading ? '-' : stats?.totalArchives ?? 0}
          icon={<Archive size={20} />}
          description="저장된 세션 기록"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">세션 현황</CardTitle>
            <div className="flex gap-1">
              {rangeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={sessionRange === option.value ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setSessionRange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {isSessionChartLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  로딩 중...
                </div>
              ) : sessionChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  데이터가 없습니다
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sessionChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="sessions"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.2}
                      name="세션 수"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">스트로크 현황</CardTitle>
            <div className="flex gap-1">
              {rangeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={strokeRange === option.value ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setStrokeRange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {isStrokeChartLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  로딩 중...
                </div>
              ) : strokeChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  데이터가 없습니다
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={strokeChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="strokes"
                      stroke="hsl(var(--accent))"
                      fill="hsl(var(--accent))"
                      fillOpacity={0.2}
                      name="스트로크 수"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">오늘의 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{isLoading ? '-' : stats?.todaySessions ?? 0}</p>
              <p className="text-sm text-muted-foreground">오늘 생성된 세션</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{isLoading ? '-' : stats?.totalUsers ?? 0}</p>
              <p className="text-sm text-muted-foreground">등록된 사용자</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{isLoading ? '-' : stats?.activeSessions ?? 0}</p>
              <p className="text-sm text-muted-foreground">현재 활성 세션</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">활성 사용자</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{isLoading ? '-' : stats?.dau ?? 0}</p>
              <p className="text-sm text-muted-foreground">DAU (일간)</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{isLoading ? '-' : stats?.wau ?? 0}</p>
              <p className="text-sm text-muted-foreground">WAU (주간)</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{isLoading ? '-' : stats?.mau ?? 0}</p>
              <p className="text-sm text-muted-foreground">MAU (월간)</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{isLoading ? '-' : stats?.yau ?? 0}</p>
              <p className="text-sm text-muted-foreground">YAU (연간)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
