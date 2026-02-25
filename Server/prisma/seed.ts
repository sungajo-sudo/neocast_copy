/**
 * Prisma Seed Script
 * 로컬 개발 환경용 더미 데이터 및 테스트 계정 생성
 *
 * 실행: npx prisma db seed
 *
 * 생성 내용:
 * - 테스트 계정: host@abc.com / 1234, guest@abc.com / 1234
 * - 샘플 세션 3개 (예정/진행중/종료)
 * - 각 세션에 참가자 기록
 */

import { PrismaClient, SessionStatus, ParticipantRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 기존 테스트 데이터 정리
  await prisma.sessionChatMessage.deleteMany({});
  await prisma.stroke.deleteMany({});
  await prisma.page.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.participant.deleteMany({});
  await prisma.archive.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.userPaper.deleteMany({});
  await prisma.ncodeAllocation.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { in: ['host@abc.com', 'guest@abc.com'] } } });

  // ─────────────────────────────────────────
  // 1. 테스트 계정 생성
  // ─────────────────────────────────────────
  const passwordHash = await bcrypt.hash('1234', 10);

  const host = await prisma.user.create({
    data: {
      email: 'host@abc.com',
      passwordHash,
      name: '선생님',
      isGuest: false,
    },
  });

  const guest = await prisma.user.create({
    data: {
      email: 'guest@abc.com',
      passwordHash,
      name: '학생',
      isGuest: false,
    },
  });

  console.log('✅ 테스트 계정 생성:', host.email, guest.email);

  // ─────────────────────────────────────────
  // 2. 샘플 세션 생성
  // ─────────────────────────────────────────
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  // 세션 1: 진행중
  const session1 = await prisma.session.create({
    data: {
      code: 'ABC123',
      hostId: host.id,
      status: SessionStatus.ACTIVE,
      allowGuestMode: true,
      createdAt: now,
    },
  });

  // 세션 2: 종료됨
  const session2 = await prisma.session.create({
    data: {
      code: 'XYZ789',
      hostId: host.id,
      status: SessionStatus.CLOSED,
      allowGuestMode: true,
      createdAt: yesterday,
      closedAt: yesterday,
    },
  });

  // 세션 3: 오래된 종료 세션
  const session3 = await prisma.session.create({
    data: {
      code: 'DEF456',
      hostId: host.id,
      status: SessionStatus.CLOSED,
      allowGuestMode: true,
      createdAt: twoDaysAgo,
      closedAt: twoDaysAgo,
    },
  });

  console.log('✅ 샘플 세션 생성:', session1.code, session2.code, session3.code);

  // ─────────────────────────────────────────
  // 3. 참가자 기록 (종료된 세션에만)
  // ─────────────────────────────────────────
  await prisma.participant.createMany({
    data: [
      {
        sessionId: session2.id,
        userId: host.id,
        role: ParticipantRole.HOST,
        joinedAt: yesterday,
        leftAt: yesterday,
      },
      {
        sessionId: session2.id,
        userId: guest.id,
        role: ParticipantRole.GUEST,
        joinedAt: yesterday,
        leftAt: yesterday,
      },
      {
        sessionId: session3.id,
        userId: host.id,
        role: ParticipantRole.HOST,
        joinedAt: twoDaysAgo,
        leftAt: twoDaysAgo,
      },
    ],
  });

  console.log('✅ 참가자 기록 생성 완료');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎓 호스트 테스트 계정: host@abc.com / 1234');
  console.log('👤 게스트 테스트 계정: guest@abc.com / 1234');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Seed 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
