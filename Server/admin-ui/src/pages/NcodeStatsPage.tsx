import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Book, Users, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
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

export default function NcodeStatsPage() {
  const [period, setPeriod] = useState<StatsPeriod>('cumulative');
  const [rankingPage, setRankingPage] = useState(0);
  const pageSize = 20;

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin', 'stats', 'ncode', period],
    queryFn: () => adminApi.getNcodeStats(period),
    refetchInterval: 30000,
  });

  const { data: rankingData, isLoading: isRankingLoading } = useQuery({
    queryKey: ['admin', 'stats', 'ncode', 'ranking', rankingPage],
    queryFn: () => adminApi.getNcodeRanking(pageSize, rankingPage * pageSize),
    refetchInterval: 30000,
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">통계를 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  const totalPages = rankingData ? Math.ceil(rankingData.pagination.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">NCode 통계</h1>
          <p className="text-muted-foreground mt-1">NCode PDF 발행 현황을 확인하세요.</p>
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
          title="발행 총 페이지 수"
          value={isLoading ? '-' : (stats?.totalPages ?? 0).toLocaleString()}
          icon={<FileText size={20} />}
          description="NCode가 적용된 총 페이지"
        />
        <StatCard
          title="등록된 교재 수"
          value={isLoading ? '-' : (stats?.registeredPapers ?? 0).toLocaleString()}
          icon={<Book size={20} />}
          description="내 교재로 등록된 PDF"
        />
        <StatCard
          title="교재 등록 고객 수"
          value={isLoading ? '-' : (stats?.uniqueCustomers ?? 0).toLocaleString()}
          icon={<Users size={20} />}
          description="교재를 등록한 고유 사용자"
        />
      </div>

      {/* Ranking Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy size={20} />
            교재 등록 순위
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRankingPage(p => Math.max(0, p - 1))}
              disabled={rankingPage === 0}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm text-muted-foreground">
              {rankingPage + 1} / {totalPages || 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRankingPage(p => p + 1)}
              disabled={rankingPage >= totalPages - 1}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isRankingLoading ? (
            <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
          ) : !rankingData?.data?.length ? (
            <div className="text-center py-8 text-muted-foreground">데이터가 없습니다</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">순위</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">이름</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">이메일</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">교재 수</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">총 페이지</th>
                  </tr>
                </thead>
                <tbody>
                  {rankingData.data.map((item, index) => (
                    <tr key={item.userId} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                          rankingPage * pageSize + index < 3
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {rankingPage * pageSize + index + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium">{item.userName}</td>
                      <td className="py-3 px-4 text-muted-foreground">{item.userEmail}</td>
                      <td className="py-3 px-4 text-right">{item.paperCount.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">{item.totalPages.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
