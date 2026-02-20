import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/index.js';
import { SessionStatus } from '@prisma/client';
import * as sessionService from '../services/session.service.js';
import * as archiveService from '../services/archive.service.js';
import { verifyAccessToken } from '../services/auth.service.js';
import { ValidationError, AuthenticationError } from '../utils/errors.js';

// 목록 조회 쿼리 스키마 (페이지네이션)
const listQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(1000).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// 시계열 데이터 조회 쿼리 스키마
const timeseriesQuerySchema = z.object({
  range: z.enum(['24h', '7d', '30d', '12m']).default('24h'),
});

/**
 * 요청 헤더에서 인증 토큰을 검증하고 사용자 정보를 반환합니다.
 * 실제 서비스에서는 Admin 권한 체크 로직이 추가되어야 합니다.
 */
function getAuthUser(request: { headers: { authorization?: string } }) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError('Authorization required');
  }
  return verifyAccessToken(authHeader.slice(7));
}

/**
 * 관리자용 API 라우트
 * 대시보드 통계, 세션 관리, 아카이브 관리 등을 수행합니다.
 */
export const adminRoutes: FastifyPluginAsync = async (app) => {
  // 대시보드 통계 요약 조회
  app.get('/stats', async (request, reply) => {
    getAuthUser(request); // 권한 검증 (프로덕션에서는 admin role 체크 필요)

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // 병렬로 주요 카운트 쿼리 실행
    const [
      activeSessionsCount,
      totalUsersCount,
      todaySessionsCount,
      totalArchivesCount,
      totalStrokesCount,
    ] = await Promise.all([
      prisma.session.count({ where: { status: SessionStatus.ACTIVE } }),
      prisma.user.count(),
      prisma.session.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.archive.count(),
      prisma.stroke.count(),
    ]);

    // 활성 세션의 현재 참여자 수 계산
    const activeParticipants = await prisma.participant.count({
      where: {
        session: { status: SessionStatus.ACTIVE },
        leftAt: null,
      },
    });

    // 활성 사용자 (Active Users) 계산
    // 기간별 세션 참여 기록이 있는 고유 사용자 수
    // DAU (Daily), WAU (Weekly), MAU (Monthly), YAU (Yearly)
    const [dauResult, wauResult, mauResult, yauResult] = await Promise.all([
      prisma.participant.groupBy({
        by: ['userId'],
        where: { joinedAt: { gte: todayStart } },
      }),
      prisma.participant.groupBy({
        by: ['userId'],
        where: { joinedAt: { gte: weekAgo } },
      }),
      prisma.participant.groupBy({
        by: ['userId'],
        where: { joinedAt: { gte: monthAgo } },
      }),
      prisma.participant.groupBy({
        by: ['userId'],
        where: { joinedAt: { gte: yearAgo } },
      }),
    ]);

    return reply.send({
      success: true,
      stats: {
        activeSessions: activeSessionsCount,
        activeParticipants,
        totalUsers: totalUsersCount,
        todaySessions: todaySessionsCount,
        totalArchives: totalArchivesCount,
        totalStrokes: totalStrokesCount,
        dau: dauResult.length,
        wau: wauResult.length,
        mau: mauResult.length,
        yau: yauResult.length,
        timestamp: now.toISOString(),
      },
    });
  });

  // 차트용 시계열 통계 조회
  app.get('/stats/timeseries', async (request, reply) => {
    getAuthUser(request);

    const result = timeseriesQuerySchema.safeParse(request.query);
    if (!result.success) {
      throw new ValidationError('Invalid query parameters', result.error.flatten().fieldErrors);
    }

    const { range } = result.data;
    const now = new Date();

    let startDate: Date;
    let groupBy: 'hour' | 'day' | 'month';
    let intervalCount: number;

    // 조회 기간 및 그룹화 단위 설정
    switch (range) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        groupBy = 'hour';
        intervalCount = 24;
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        intervalCount = 7;
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        intervalCount = 30;
        break;
      case '12m':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        groupBy = 'month';
        intervalCount = 12;
        break;
    }

    // 시간 버킷(구간) 생성
    const buckets: { label: string; start: Date; end: Date }[] = [];
    for (let i = 0; i < intervalCount; i++) {
      let bucketStart: Date;
      let bucketEnd: Date;
      let label: string;

      if (groupBy === 'hour') {
        bucketStart = new Date(startDate.getTime() + i * 60 * 60 * 1000);
        bucketEnd = new Date(bucketStart.getTime() + 60 * 60 * 1000);
        label = bucketStart.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
      } else if (groupBy === 'day') {
        bucketStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        bucketStart.setHours(0, 0, 0, 0);
        bucketEnd = new Date(bucketStart.getTime() + 24 * 60 * 60 * 1000);
        label = bucketStart.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      } else {
        // month
        bucketStart = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        bucketEnd = new Date(startDate.getFullYear(), startDate.getMonth() + i + 1, 1);
        label = bucketStart.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short' });
      }

      buckets.push({ label, start: bucketStart, end: bucketEnd });
    }

    // 각 버킷별 세션 생성 수 조회
    const sessionCounts = await Promise.all(
      buckets.map((bucket) =>
        prisma.session.count({
          where: {
            createdAt: {
              gte: bucket.start,
              lt: bucket.end,
            },
          },
        })
      )
    );

    // 각 버킷별 스트로크 수 조회
    const strokeCounts = await Promise.all(
      buckets.map((bucket) =>
        prisma.stroke.count({
          where: {
            createdAt: {
              gte: bucket.start,
              lt: bucket.end,
            },
          },
        })
      )
    );

    const data = buckets.map((bucket, i) => ({
      name: bucket.label,
      sessions: sessionCounts[i],
      strokes: strokeCounts[i],
    }));

    return reply.send({
      success: true,
      range,
      data,
    });
  });

  // 상세 통계 조회
  app.get('/stats/detailed', async (request, reply) => {
    getAuthUser(request);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 최근 30일간 일별 세션 수 (Raw Query 사용)
    const sessionsPerDay = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM sessions
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // 평균 세션 지속 시간 (아카이브 기준)
    const avgDuration = await prisma.archive.aggregate({
      _avg: { duration: true },
    });

    // 세션 당 평균 참여자 수
    const participantStats = await prisma.$queryRaw<Array<{ avg_participants: number }>>`
      SELECT AVG(participant_count) as avg_participants
      FROM (
        SELECT session_id, COUNT(*) as participant_count
        FROM participants
        GROUP BY session_id
      ) as counts
    `;

    // 상태별 세션 수
    const sessionsByStatus = await prisma.session.groupBy({
      by: ['status'],
      _count: true,
    });

    return reply.send({
      success: true,
      detailed: {
        sessionsPerDay: sessionsPerDay.map((d) => ({
          date: d.date,
          count: Number(d.count),
        })),
        averageSessionDuration: avgDuration._avg.duration || 0,
        averageParticipants: participantStats[0]?.avg_participants || 0,
        sessionsByStatus: sessionsByStatus.reduce(
          (acc, s) => {
            acc[s.status] = s._count;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
    });
  });

  // 활성 세션 목록 조회
  app.get('/sessions', async (request, reply) => {
    getAuthUser(request);

    const result = listQuerySchema.safeParse(request.query);
    if (!result.success) {
      throw new ValidationError('Invalid query parameters', result.error.flatten().fieldErrors);
    }

    const { limit, offset } = result.data;
    const sessions = await sessionService.getActiveSessions(limit, offset);
    const total = await sessionService.getActiveSessionsCount();

    // 조회된 세션들에 대한 스트로크 수 조회
    const sessionIds = sessions.map((s) => s.id);
    const strokeCounts = await prisma.stroke.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: sessionIds } },
      _count: { id: true },
    });
    const strokeCountMap = new Map(strokeCounts.map((s) => [s.sessionId, s._count.id]));

    // 호스트 연결 끊김 상태 확인
    const disconnectedHostStatuses = await sessionService.getDisconnectedHostStatuses(sessionIds);

    return reply.send({
      success: true,
      sessions: sessions.map((s) => {
        const isHostOnline = !disconnectedHostStatuses.get(s.id);
        // 호스트가 온라인이면 전체 인원, 아니면 호스트 제외 인원 표시
        const onlineParticipantCount = isHostOnline
          ? s.participants.length
          : s.participants.filter((p) => p.userId !== s.hostId).length;

        return {
          id: s.id,
          code: s.code,
          hostName: s.host.name,
          hostEmail: s.host.email,
          status: s.status,
          participantCount: onlineParticipantCount,
          isHostOnline,
          strokeCount: strokeCountMap.get(s.id) || 0,
          createdAt: s.createdAt,
        };
      }),
      pagination: { limit, offset, total },
    });
  });

  // 세션 상세 정보 조회 (관리자용)
  app.get('/sessions/:id', async (request, reply) => {
    getAuthUser(request);
    const { id } = request.params as { id: string };

    const session = await sessionService.getSessionById(id);
    if (!session) {
      throw new ValidationError('Session not found');
    }

    // 스트로크 수 조회
    const strokeCount = await prisma.stroke.count({ where: { sessionId: id } });

    return reply.send({
      success: true,
      session: {
        ...session,
        strokeCount,
        duration: Math.floor((Date.now() - session.createdAt.getTime()) / 1000), // 현재까지의 지속 시간
      },
    });
  });

  // 세션 강제 종료 (관리자 기능)
  app.post('/sessions/:id/close', async (request, reply) => {
    getAuthUser(request);
    const { id } = request.params as { id: string };

    const session = await sessionService.getSessionById(id);
    if (!session) {
      throw new ValidationError('Session not found');
    }

    // 호스트 권한으로 세션 종료 처리
    await sessionService.closeSession(id, session.hostId);

    return reply.send({
      success: true,
      message: 'Session closed',
    });
  });

  // 전체 아카이브 목록 조회 (관리자용)
  app.get('/archives', async (request, reply) => {
    getAuthUser(request);

    const result = listQuerySchema.safeParse(request.query);
    if (!result.success) {
      throw new ValidationError('Invalid query parameters', result.error.flatten().fieldErrors);
    }

    const { limit, offset } = result.data;

    const archives = await prisma.archive.findMany({
      select: {
        id: true,
        originalSessionId: true,
        hostId: true,
        totalStrokes: true,
        totalPages: true,
        duration: true,
        linkedPrevId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // 호스트 이름 조회 (N+1 문제 방지용 In-memory 매핑)
    const hostIds = [...new Set(archives.map((a) => a.hostId))];
    const hosts = await prisma.user.findMany({
      where: { id: { in: hostIds } },
      select: { id: true, name: true },
    });
    const hostMap = new Map(hosts.map((h) => [h.id, h.name]));

    const total = await archiveService.getArchiveCount();

    return reply.send({
      success: true,
      archives: archives.map((a) => ({
        id: a.id,
        hostName: hostMap.get(a.hostId) || 'Unknown',
        totalStrokes: a.totalStrokes,
        totalPages: a.totalPages,
        duration: a.duration,
        hasLinkedPrev: !!a.linkedPrevId,
        createdAt: a.createdAt,
      })),
      pagination: { limit, offset, total },
    });
  });

  // 스토리지 사용량 통계 조회
  app.get('/storage', async (request, reply) => {
    getAuthUser(request);

    // 스토리지 사용량 추정 (데이터 길이 합산)
    const archiveStats = await prisma.$queryRaw<Array<{ total_size: bigint; count: bigint }>>`
      SELECT SUM(LENGTH(data)) as total_size, COUNT(*) as count
      FROM archives
    `;

    const strokeStats = await prisma.$queryRaw<Array<{ total_size: bigint; count: bigint }>>`
      SELECT SUM(LENGTH(points)) as total_size, COUNT(*) as count
      FROM strokes
    `;

    return reply.send({
      success: true,
      storage: {
        archives: {
          count: Number(archiveStats[0]?.count || 0),
          sizeBytes: Number(archiveStats[0]?.total_size || 0),
        },
        strokes: {
          count: Number(strokeStats[0]?.count || 0),
          sizeBytes: Number(strokeStats[0]?.total_size || 0),
        },
      },
    });
  });

  // ============================================
  // 신규 통계 API (v2) - 하위호환성 유지
  // ============================================

  // 기간 파라미터 스키마
  const periodQuerySchema = z.object({
    period: z.enum(['cumulative', 'daily', 'weekly', 'monthly', 'yearly']).default('cumulative'),
  });

  // 페이징 + 기간 스키마
  const paginatedPeriodQuerySchema = z.object({
    period: z.enum(['cumulative', 'daily', 'weekly', 'monthly', 'yearly']).default('cumulative'),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
  });

  /**
   * 기간별 날짜 필터 생성 헬퍼
   */
  function getPeriodDateFilter(period: string): { gte?: Date } | undefined {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case 'daily':
        return { gte: todayStart };
      case 'weekly':
        return { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      case 'monthly':
        return { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      case 'yearly':
        return { gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) };
      case 'cumulative':
      default:
        return undefined;
    }
  }

  // ============================================
  // 이용자 통계 API
  // ============================================

  /**
   * GET /admin/stats/users
   * 이용자 통계 조회
   * - 등록자 수 (기간별)
   * - 세션 참여 횟수 (로그인 대체)
   * - 평균 세션 참여 시간
   * - 평균 아카이브 세션 시간
   */
  app.get('/stats/users', async (request, reply) => {
    getAuthUser(request);

    const result = periodQuerySchema.safeParse(request.query);
    if (!result.success) {
      throw new ValidationError('Invalid query parameters', result.error.flatten().fieldErrors);
    }

    const { period } = result.data;
    const dateFilter = getPeriodDateFilter(period);

    // 병렬로 통계 쿼리 실행
    const [
      registeredUsersCount,
      sessionParticipationCount,
      avgSessionDuration,
      avgArchiveDuration,
    ] = await Promise.all([
      // 등록자 수
      prisma.user.count({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      // 세션 참여 횟수 (Participant 레코드 수 - 로그인 대체)
      prisma.participant.count({
        where: dateFilter ? { joinedAt: dateFilter } : undefined,
      }),
      // 평균 세션 참여 시간 (leftAt이 있는 참여자만)
      dateFilter
        ? prisma.$queryRaw<Array<{ avg_duration: number | null }>>`
            SELECT AVG(EXTRACT(EPOCH FROM (left_at - joined_at))) as avg_duration
            FROM participants
            WHERE left_at IS NOT NULL AND joined_at >= ${dateFilter.gte}
          `
        : prisma.$queryRaw<Array<{ avg_duration: number | null }>>`
            SELECT AVG(EXTRACT(EPOCH FROM (left_at - joined_at))) as avg_duration
            FROM participants
            WHERE left_at IS NOT NULL
          `,
      // 평균 아카이브 세션 시간
      prisma.archive.aggregate({
        _avg: { duration: true },
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
    ]);

    // 기간별 추이 데이터 (시계열)
    const now = new Date();
    let timeseriesData: Array<{ label: string; users: number; participations: number }> = [];

    if (period !== 'cumulative') {
      // 최근 7일간 일별 데이터
      const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : period === 'monthly' ? 30 : 12;
      const isMonthly = period === 'yearly';

      for (let i = days - 1; i >= 0; i--) {
        let start: Date;
        let end: Date;
        let label: string;

        if (isMonthly) {
          start = new Date(now.getFullYear(), now.getMonth() - i, 1);
          end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
          label = start.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short' });
        } else {
          start = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          start.setHours(0, 0, 0, 0);
          end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
          label = start.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        }

        const [users, participations] = await Promise.all([
          prisma.user.count({
            where: { createdAt: { gte: start, lt: end } },
          }),
          prisma.participant.count({
            where: { joinedAt: { gte: start, lt: end } },
          }),
        ]);

        timeseriesData.push({ label, users, participations });
      }
    }

    return reply.send({
      success: true,
      period,
      stats: {
        registeredUsers: registeredUsersCount,
        sessionParticipations: sessionParticipationCount,
        avgParticipationDuration: Math.round(avgSessionDuration[0]?.avg_duration || 0),
        avgArchiveSessionDuration: Math.round(avgArchiveDuration._avg.duration || 0),
      },
      timeseries: timeseriesData,
    });
  });

  // ============================================
  // NCode 발행 통계 API
  // ============================================

  /**
   * GET /admin/stats/ncode
   * NCode 발행 통계 조회
   * - 전체 발행 페이지 수
   * - 등록된 교재 수
   * - 교재 등록 고객 수
   */
  app.get('/stats/ncode', async (request, reply) => {
    getAuthUser(request);

    const result = periodQuerySchema.safeParse(request.query);
    if (!result.success) {
      throw new ValidationError('Invalid query parameters', result.error.flatten().fieldErrors);
    }

    const { period } = result.data;
    const dateFilter = getPeriodDateFilter(period);

    const whereClause = dateFilter ? { createdAt: dateFilter } : undefined;

    // 병렬로 통계 쿼리 실행
    const [
      totalPagesResult,
      totalPapersCount,
      uniqueUsersResult,
    ] = await Promise.all([
      // 전체 발행 페이지 수
      prisma.userPaper.aggregate({
        _sum: { pageCount: true },
        where: whereClause,
      }),
      // 등록된 교재 수
      prisma.userPaper.count({
        where: whereClause,
      }),
      // 교재 등록 고객 수 (고유 userId)
      prisma.userPaper.groupBy({
        by: ['userId'],
        where: whereClause,
      }),
    ]);

    // 기간별 추이 데이터
    const now = new Date();
    let timeseriesData: Array<{ label: string; pages: number; papers: number }> = [];

    if (period !== 'cumulative') {
      const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : period === 'monthly' ? 30 : 12;
      const isMonthly = period === 'yearly';

      for (let i = days - 1; i >= 0; i--) {
        let start: Date;
        let end: Date;
        let label: string;

        if (isMonthly) {
          start = new Date(now.getFullYear(), now.getMonth() - i, 1);
          end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
          label = start.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short' });
        } else {
          start = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          start.setHours(0, 0, 0, 0);
          end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
          label = start.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        }

        const [pagesResult, papersCount] = await Promise.all([
          prisma.userPaper.aggregate({
            _sum: { pageCount: true },
            where: { createdAt: { gte: start, lt: end } },
          }),
          prisma.userPaper.count({
            where: { createdAt: { gte: start, lt: end } },
          }),
        ]);

        timeseriesData.push({
          label,
          pages: pagesResult._sum.pageCount || 0,
          papers: papersCount,
        });
      }
    }

    return reply.send({
      success: true,
      period,
      stats: {
        totalPages: totalPagesResult._sum.pageCount || 0,
        totalPapers: totalPapersCount,
        uniqueUsers: uniqueUsersResult.length,
      },
      timeseries: timeseriesData,
    });
  });

  /**
   * GET /admin/stats/ncode/ranking
   * 교재 등록 순위 (페이징)
   */
  app.get('/stats/ncode/ranking', async (request, reply) => {
    getAuthUser(request);

    const result = paginatedPeriodQuerySchema.safeParse(request.query);
    if (!result.success) {
      throw new ValidationError('Invalid query parameters', result.error.flatten().fieldErrors);
    }

    const { period, limit, offset } = result.data;
    const dateFilter = getPeriodDateFilter(period);

    // 사용자별 교재 등록 수 집계
    const rankings = dateFilter
      ? await prisma.$queryRaw<Array<{
          user_id: string;
          name: string;
          email: string;
          paper_count: bigint;
          total_pages: bigint;
        }>>`
          SELECT
            u.id as user_id,
            u.name,
            u.email,
            COUNT(up.id) as paper_count,
            COALESCE(SUM(up.page_count), 0) as total_pages
          FROM users u
          INNER JOIN user_papers up ON u.id = up.user_id
          WHERE up.created_at >= ${dateFilter.gte}
          GROUP BY u.id, u.name, u.email
          ORDER BY paper_count DESC, total_pages DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await prisma.$queryRaw<Array<{
          user_id: string;
          name: string;
          email: string;
          paper_count: bigint;
          total_pages: bigint;
        }>>`
          SELECT
            u.id as user_id,
            u.name,
            u.email,
            COUNT(up.id) as paper_count,
            COALESCE(SUM(up.page_count), 0) as total_pages
          FROM users u
          INNER JOIN user_papers up ON u.id = up.user_id
          GROUP BY u.id, u.name, u.email
          ORDER BY paper_count DESC, total_pages DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

    // 전체 카운트
    const totalResult = dateFilter
      ? await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT user_id) as count
          FROM user_papers
          WHERE created_at >= ${dateFilter.gte}
        `
      : await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT user_id) as count
          FROM user_papers
        `;

    return reply.send({
      success: true,
      period,
      rankings: rankings.map((r, index) => ({
        rank: offset + index + 1,
        userId: r.user_id,
        name: r.name,
        email: r.email,
        paperCount: Number(r.paper_count),
        totalPages: Number(r.total_pages),
      })),
      pagination: {
        limit,
        offset,
        total: Number(totalResult[0]?.count || 0),
      },
    });
  });

  // ============================================
  // 채팅 통계 API
  // ============================================

  /**
   * GET /admin/stats/chat
   * 세션 채팅 통계 조회
   * - 채팅 메시지 수
   * - 첨부파일 용량 (metadata에서 추출)
   */
  app.get('/stats/chat', async (request, reply) => {
    getAuthUser(request);

    const result = periodQuerySchema.safeParse(request.query);
    if (!result.success) {
      throw new ValidationError('Invalid query parameters', result.error.flatten().fieldErrors);
    }

    const { period } = result.data;
    const dateFilter = getPeriodDateFilter(period);
    const whereClause = dateFilter ? { createdAt: dateFilter } : undefined;

    // 병렬로 통계 쿼리 실행
    const [
      totalMessagesCount,
      fileMessagesCount,
      fileMessages,
    ] = await Promise.all([
      // 전체 채팅 메시지 수
      prisma.sessionChatMessage.count({
        where: whereClause,
      }),
      // 파일 타입 메시지 수
      prisma.sessionChatMessage.count({
        where: {
          ...whereClause,
          type: 'file',
        },
      }),
      // 파일 메시지들 (metadata에서 용량 추출용)
      prisma.sessionChatMessage.findMany({
        where: {
          ...whereClause,
          type: 'file',
          metadata: { not: null },
        },
        select: { metadata: true },
      }),
    ]);

    // 첨부파일 용량 계산 (metadata JSON에서 size 추출)
    let totalFileSize = 0;
    for (const msg of fileMessages) {
      if (msg.metadata) {
        try {
          const meta = JSON.parse(msg.metadata);
          if (meta.size && typeof meta.size === 'number') {
            totalFileSize += meta.size;
          }
        } catch {
          // JSON 파싱 실패 시 무시
        }
      }
    }

    // 기간별 추이 데이터
    const now = new Date();
    let timeseriesData: Array<{ label: string; messages: number }> = [];

    if (period !== 'cumulative') {
      const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : period === 'monthly' ? 30 : 12;
      const isMonthly = period === 'yearly';

      for (let i = days - 1; i >= 0; i--) {
        let start: Date;
        let end: Date;
        let label: string;

        if (isMonthly) {
          start = new Date(now.getFullYear(), now.getMonth() - i, 1);
          end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
          label = start.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short' });
        } else {
          start = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          start.setHours(0, 0, 0, 0);
          end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
          label = start.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        }

        const messagesCount = await prisma.sessionChatMessage.count({
          where: { createdAt: { gte: start, lt: end } },
        });

        timeseriesData.push({ label, messages: messagesCount });
      }
    }

    return reply.send({
      success: true,
      period,
      stats: {
        totalMessages: totalMessagesCount,
        fileMessages: fileMessagesCount,
        totalFileSizeBytes: totalFileSize,
      },
      timeseries: timeseriesData,
    });
  });

  // ============================================
  // 메신저 통계 API
  // ============================================

  /**
   * GET /admin/stats/messenger
   * 메신저 통계 조회
   * - DM 메시지 수
   * - 활성 쓰레드 수
   * - 친구 관계 수
   */
  app.get('/stats/messenger', async (request, reply) => {
    getAuthUser(request);

    const result = periodQuerySchema.safeParse(request.query);
    if (!result.success) {
      throw new ValidationError('Invalid query parameters', result.error.flatten().fieldErrors);
    }

    const { period } = result.data;
    const dateFilter = getPeriodDateFilter(period);

    // 병렬로 통계 쿼리 실행
    const [
      totalDmMessagesCount,
      totalThreadsCount,
      activeThreadsCount,
      totalFriendshipsCount,
    ] = await Promise.all([
      // DM 메시지 수
      prisma.directMessage.count({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      // 전체 쓰레드 수
      prisma.directMessageThread.count({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      // 활성 쓰레드 수 (최근 메시지가 있는 쓰레드)
      prisma.directMessageThread.count({
        where: dateFilter ? { lastMessageAt: dateFilter } : { lastMessageAt: { not: null } },
      }),
      // 친구 관계 수
      prisma.friendship.count({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
    ]);

    // 기간별 추이 데이터
    const now = new Date();
    let timeseriesData: Array<{ label: string; messages: number; friendships: number }> = [];

    if (period !== 'cumulative') {
      const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : period === 'monthly' ? 30 : 12;
      const isMonthly = period === 'yearly';

      for (let i = days - 1; i >= 0; i--) {
        let start: Date;
        let end: Date;
        let label: string;

        if (isMonthly) {
          start = new Date(now.getFullYear(), now.getMonth() - i, 1);
          end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
          label = start.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short' });
        } else {
          start = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          start.setHours(0, 0, 0, 0);
          end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
          label = start.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        }

        const [messagesCount, friendshipsCount] = await Promise.all([
          prisma.directMessage.count({
            where: { createdAt: { gte: start, lt: end } },
          }),
          prisma.friendship.count({
            where: { createdAt: { gte: start, lt: end } },
          }),
        ]);

        timeseriesData.push({ label, messages: messagesCount, friendships: friendshipsCount });
      }
    }

    return reply.send({
      success: true,
      period,
      stats: {
        totalDmMessages: totalDmMessagesCount,
        totalThreads: totalThreadsCount,
        activeThreads: activeThreadsCount,
        totalFriendships: totalFriendshipsCount,
      },
      timeseries: timeseriesData,
    });
  });

  // ============================================
  // 스토리지 상세 통계 API
  // ============================================

  /**
   * GET /admin/stats/storage-detailed
   * 상세 스토리지 통계 조회 (기간별)
   */
  app.get('/stats/storage-detailed', async (request, reply) => {
    getAuthUser(request);

    const result = periodQuerySchema.safeParse(request.query);
    if (!result.success) {
      throw new ValidationError('Invalid query parameters', result.error.flatten().fieldErrors);
    }

    const { period } = result.data;
    const dateFilter = getPeriodDateFilter(period);

    // 병렬로 통계 쿼리 실행
    const [
      pdfStorageResult,
      archiveStorageResult,
      strokeStorageResult,
    ] = await Promise.all([
      // PDF 스토리지 (UserPaper.pdfSize)
      prisma.userPaper.aggregate({
        _sum: { pdfSize: true },
        _count: true,
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      // 아카이브 스토리지
      dateFilter
        ? prisma.$queryRaw<Array<{ total_size: bigint; count: bigint }>>`
            SELECT COALESCE(SUM(LENGTH(data)), 0) as total_size, COUNT(*) as count
            FROM archives
            WHERE created_at >= ${dateFilter.gte}
          `
        : prisma.$queryRaw<Array<{ total_size: bigint; count: bigint }>>`
            SELECT COALESCE(SUM(LENGTH(data)), 0) as total_size, COUNT(*) as count
            FROM archives
          `,
      // 스트로크 스토리지
      dateFilter
        ? prisma.$queryRaw<Array<{ total_size: bigint; count: bigint }>>`
            SELECT COALESCE(SUM(LENGTH(points)), 0) as total_size, COUNT(*) as count
            FROM strokes
            WHERE created_at >= ${dateFilter.gte}
          `
        : prisma.$queryRaw<Array<{ total_size: bigint; count: bigint }>>`
            SELECT COALESCE(SUM(LENGTH(points)), 0) as total_size, COUNT(*) as count
            FROM strokes
          `,
    ]);

    // 기간별 추이 데이터
    const now = new Date();
    let timeseriesData: Array<{ label: string; pdfSize: number; archiveSize: number }> = [];

    if (period !== 'cumulative') {
      const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : period === 'monthly' ? 30 : 12;
      const isMonthly = period === 'yearly';

      for (let i = days - 1; i >= 0; i--) {
        let start: Date;
        let end: Date;
        let label: string;

        if (isMonthly) {
          start = new Date(now.getFullYear(), now.getMonth() - i, 1);
          end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
          label = start.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short' });
        } else {
          start = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          start.setHours(0, 0, 0, 0);
          end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
          label = start.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        }

        const [pdfResult, archiveResult] = await Promise.all([
          prisma.userPaper.aggregate({
            _sum: { pdfSize: true },
            where: { createdAt: { gte: start, lt: end } },
          }),
          prisma.$queryRaw<Array<{ total_size: bigint }>>`
            SELECT COALESCE(SUM(LENGTH(data)), 0) as total_size
            FROM archives
            WHERE created_at >= ${start} AND created_at < ${end}
          `,
        ]);

        timeseriesData.push({
          label,
          pdfSize: pdfResult._sum.pdfSize || 0,
          archiveSize: Number(archiveResult[0]?.total_size || 0),
        });
      }
    }

    return reply.send({
      success: true,
      period,
      stats: {
        pdf: {
          count: pdfStorageResult._count,
          sizeBytes: pdfStorageResult._sum.pdfSize || 0,
        },
        archives: {
          count: Number(archiveStorageResult[0]?.count || 0),
          sizeBytes: Number(archiveStorageResult[0]?.total_size || 0),
        },
        strokes: {
          count: Number(strokeStorageResult[0]?.count || 0),
          sizeBytes: Number(strokeStorageResult[0]?.total_size || 0),
        },
        totalSizeBytes:
          (pdfStorageResult._sum.pdfSize || 0) +
          Number(archiveStorageResult[0]?.total_size || 0) +
          Number(strokeStorageResult[0]?.total_size || 0),
      },
      timeseries: timeseriesData,
    });
  });

  // ============================================
  // PDF 관리 API
  // ============================================

  /**
   * GET /admin/papers
   * 등록된 PDF 리스트 조회 (페이징)
   */
  app.get('/papers', async (request, reply) => {
    getAuthUser(request);

    const querySchema = z.object({
      limit: z.coerce.number().min(1).max(100).default(20),
      offset: z.coerce.number().min(0).default(0),
      search: z.string().optional(),
      sortBy: z.enum(['createdAt', 'title', 'pageCount', 'pdfSize']).default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    });

    const result = querySchema.safeParse(request.query);
    if (!result.success) {
      throw new ValidationError('Invalid query parameters', result.error.flatten().fieldErrors);
    }

    const { limit, offset, search, sortBy, sortOrder } = result.data;

    // 검색 조건
    const whereClause = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { user: { name: { contains: search, mode: 'insensitive' as const } } },
            { user: { email: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : undefined;

    const [papers, total] = await Promise.all([
      prisma.userPaper.findMany({
        where: whereClause,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
      }),
      prisma.userPaper.count({ where: whereClause }),
    ]);

    return reply.send({
      success: true,
      papers: papers.map((p) => ({
        id: p.id,
        title: p.title,
        section: p.section,
        owner: p.owner,
        book: p.book,
        pageStart: p.pageStart,
        pageEnd: p.pageEnd,
        pageCount: p.pageCount,
        pdfSize: p.pdfSize,
        pdfPath: p.pdfPath,
        user: {
          id: p.user.id,
          name: p.user.name,
          email: p.user.email,
        },
        createdAt: p.createdAt,
      })),
      pagination: { limit, offset, total },
    });
  });

  /**
   * GET /admin/papers/:id
   * PDF 상세 정보 조회
   */
  app.get('/papers/:id', async (request, reply) => {
    getAuthUser(request);
    const { id } = request.params as { id: string };

    const paper = await prisma.userPaper.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!paper) {
      throw new ValidationError('Paper not found');
    }

    return reply.send({
      success: true,
      paper: {
        id: paper.id,
        title: paper.title,
        section: paper.section,
        owner: paper.owner,
        book: paper.book,
        pageStart: paper.pageStart,
        pageEnd: paper.pageEnd,
        pageCount: paper.pageCount,
        pdfSize: paper.pdfSize,
        pdfPath: paper.pdfPath,
        sobKey: paper.sobKey,
        paperGroupId: paper.paperGroupId,
        user: {
          id: paper.user.id,
          name: paper.user.name,
          email: paper.user.email,
        },
        createdAt: paper.createdAt,
      },
    });
  });

  /**
   * GET /admin/papers/:id/preview
   * PDF 미리보기 URL 반환 (GCS Signed URL 또는 직접 경로)
   */
  app.get('/papers/:id/preview', async (request, reply) => {
    getAuthUser(request);
    const { id } = request.params as { id: string };

    const paper = await prisma.userPaper.findUnique({
      where: { id },
      select: { id: true, title: true, pdfPath: true },
    });

    if (!paper) {
      throw new ValidationError('Paper not found');
    }

    // pdfPath가 GCS 경로인 경우 signed URL 생성 필요
    // 현재는 경로만 반환 (실제 구현 시 GCS signed URL 생성 로직 추가)
    return reply.send({
      success: true,
      preview: {
        id: paper.id,
        title: paper.title,
        url: paper.pdfPath, // TODO: GCS signed URL로 변환
      },
    });
  });
};
