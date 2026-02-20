import 'dotenv/config';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { buildApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './db/index.js';
import { setupSocketIO } from './socket/index.js';
import { closeRedis } from './utils/redis.js';
import { ndpRouterService } from './services/ndp-router.service.js';
import { initializeStorage } from './services/storage/index.js';

/**
 * 서버 메인 진입점 함수
 * 데이터베이스 연결, 소켓 설정, 라우트 등록 및 서버 실행을 담당합니다.
 */
async function main() {
  // NDP 라우터를 초기화하여 프로덕션 서버 URL 정보를 가져옵니다.
  await ndpRouterService.initialize();
  logger.info('NDP router initialized');

  // 스토리지 초기화 (GCS 버킷 생성 등)
  await initializeStorage();

  // Fastify 애플리케이션 인스턴스를 생성합니다.
  const app = await buildApp();

  // 데이터베이스에 연결합니다.
  await connectDatabase();

  // Socket.IO를 설정합니다 (Fastify 서버 인스턴스 사용).
  const { io } = setupSocketIO(app.server);

  // API 라우트를 등록합니다 (동적 import 사용).
  // 인증 관련 라우트
  await import('./routes/auth.js').then((m) => app.register(m.authRoutes, { prefix: '/api/auth' }));
  // 세션 관련 라우트
  await import('./routes/sessions.js').then((m) => app.register(m.sessionRoutes, { prefix: '/api/sessions' }));
  // 아카이브(저장소) 관련 라우트
  await import('./routes/archives.js').then((m) => app.register(m.archiveRoutes, { prefix: '/api/archives' }));
  // 관리자 관련 라우트
  await import('./routes/admin.js').then((m) => app.register(m.adminRoutes, { prefix: '/api/admin' }));
  // 페이퍼 허브 - 페이퍼 정보 관련 라우트
  await import('./routes/paperhub-paper-info.js').then((m) =>
    app.register(m.paperHubPaperInfoRoutes, { prefix: '/api/paperhub/paper-info' })
  );
  // 페이퍼 허브 - 페이퍼 등록 관련 라우트
  await import('./routes/paperhub-paper-register.js').then((m) =>
    app.register(m.paperHubPaperRegisterRoutes, { prefix: '/api/paperhub/paper-register' })
  );
  // NcPaperHub - 이용자별 SOBP 할당 및 페이퍼 관리 라우트
  await import('./routes/nc-paperhub.js').then((m) =>
    app.register(m.ncPaperHubRoutes, { prefix: '/api/nc-paperhub' })
  );
  // 파일 업로드 - 채팅 첨부 및 일반 파일 업로드 라우트
  await import('./routes/file-upload.js').then((m) =>
    app.register(m.fileUploadRoutes, { prefix: '/api/files' })
  );
  // 친구 관리 라우트
  await import('./routes/friends.js').then((m) =>
    app.register(m.friendRoutes, { prefix: '/api/friends' })
  );
  // 친구 그룹 관리 라우트
  await import('./routes/friend-groups.js').then((m) =>
    app.register(m.friendGroupRoutes, { prefix: '/api/friend-groups' })
  );
  // 다이렉트 메시지 라우트
  await import('./routes/messages.js').then((m) =>
    app.register(m.messageRoutes, { prefix: '/api/messages' })
  );
  // 세션 채팅 라우트 (메신저에서 세션 채팅 조회용)
  await import('./routes/session-chat.js').then((m) =>
    app.register(m.sessionChatRoutes, { prefix: '/api/session-chat' })
  );

  // 존재하지 않는 API 경로 처리: 브라우저면 프론트엔드로 리다이렉트
  app.setNotFoundHandler((request, reply) => {
    const accept = request.headers.accept || '';
    if (accept.includes('text/html')) {
      return reply.redirect('/');
    }
    return reply.status(404).send({
      message: `Route ${request.method}:${request.url} not found`,
      error: 'Not Found',
      statusCode: 404,
    });
  });

  /**
   * 서버 종료 시 리소스를 정리하는 함수
   * 소켓 연결 종료, 서버 종료, DB 연결 해제 등을 수행합니다.
   * @param signal 수신한 종료 시그널 (예: SIGTERM, SIGINT)
   */
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    io.close();
    await app.close();
    await disconnectDatabase();
    await closeRedis();

    logger.info('Shutdown complete');
    process.exit(0);
  };

  // 종료 시그널 핸들러 등록
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    // 서버 리스닝 시작
    await app.listen({ port: config.port, host: config.host });
    logger.info(`Server listening on http://${config.host}:${config.port}`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

// 메인 함수 실행 및 시작 에러 처리
main().catch((err) => {
  logger.error(err, 'Unhandled error during startup');
  process.exit(1);
});
