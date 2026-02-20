import { prisma } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';

// 관계 플래그 비트마스크
export const RelationFlags = {
  FRIEND: 1,
  TEACHER: 2,
  STUDENT: 4,
  PARENT: 8,
  CHILD: 16,
} as const;

export interface FriendInfo {
  id: string;
  friendId: string;
  email: string;
  name: string;
  relationFlags: number;
  groupId: string | null;
  groupName: string | null;
  createdAt: Date;
}

export interface FriendRequestInfo {
  id: string;
  fromUserId: string;
  fromUserEmail: string;
  fromUserName: string;
  toUserId: string;
  toUserEmail: string;
  toUserName: string;
  message: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: Date;
  respondedAt: Date | null;
}

export interface FriendGroupInfo {
  id: string;
  name: string;
  color: string | null;
  friendCount: number;
  createdAt: Date;
}

/**
 * 사용자의 친구 목록 조회
 */
export async function getFriends(userId: string): Promise<FriendInfo[]> {
  const friendships = await prisma.friendship.findMany({
    where: { userId },
    include: {
      friend: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      group: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return friendships.map((f) => ({
    id: f.id,
    friendId: f.friend.id,
    email: f.friend.email,
    name: f.friend.name,
    relationFlags: f.relationFlags,
    groupId: f.groupId,
    groupName: f.group?.name ?? null,
    createdAt: f.createdAt,
  }));
}

/**
 * 친구 요청 보내기
 */
export async function sendFriendRequest(
  fromUserId: string,
  toEmail: string,
  message?: string
): Promise<FriendRequestInfo> {
  // 대상 사용자 찾기
  const toUser = await prisma.user.findUnique({
    where: { email: toEmail },
    select: { id: true, email: true, name: true },
  });

  if (!toUser) {
    throw new NotFoundError('User not found with this email');
  }

  if (toUser.id === fromUserId) {
    throw new ValidationError('Cannot send friend request to yourself');
  }

  // 이미 친구인지 확인
  const existingFriendship = await prisma.friendship.findUnique({
    where: {
      userId_friendId: { userId: fromUserId, friendId: toUser.id },
    },
  });

  if (existingFriendship) {
    throw new ConflictError('Already friends with this user');
  }

  // 이미 요청이 있는지 확인
  const existingRequest = await prisma.friendRequest.findUnique({
    where: {
      fromUserId_toUserId: { fromUserId, toUserId: toUser.id },
    },
  });

  if (existingRequest) {
    if (existingRequest.status === 'PENDING') {
      throw new ConflictError('Friend request already sent');
    }
    // 이전 거절된 요청 삭제 후 재생성
    await prisma.friendRequest.delete({ where: { id: existingRequest.id } });
  }

  // 역방향 요청이 있는지 확인 (상대방이 이미 요청을 보냈는지)
  const reverseRequest = await prisma.friendRequest.findUnique({
    where: {
      fromUserId_toUserId: { fromUserId: toUser.id, toUserId: fromUserId },
    },
  });

  if (reverseRequest && reverseRequest.status === 'PENDING') {
    // 상대방의 요청이 있으면 자동으로 수락
    return acceptRequest(reverseRequest.id, fromUserId);
  }

  // 발신자 정보 가져오기
  const fromUser = await prisma.user.findUnique({
    where: { id: fromUserId },
    select: { email: true, name: true },
  });

  const request = await prisma.friendRequest.create({
    data: {
      fromUserId,
      toUserId: toUser.id,
      message: message ?? null,
    },
  });

  logger.info({ fromUserId, toUserId: toUser.id }, 'Friend request sent');

  return {
    id: request.id,
    fromUserId,
    fromUserEmail: fromUser!.email,
    fromUserName: fromUser!.name,
    toUserId: toUser.id,
    toUserEmail: toUser.email,
    toUserName: toUser.name,
    message: request.message,
    status: request.status,
    createdAt: request.createdAt,
    respondedAt: request.respondedAt,
  };
}

/**
 * 받은 친구 요청 목록 조회
 */
export async function getReceivedRequests(userId: string): Promise<FriendRequestInfo[]> {
  const requests = await prisma.friendRequest.findMany({
    where: {
      toUserId: userId,
      status: 'PENDING',
    },
    include: {
      fromUser: {
        select: { id: true, email: true, name: true },
      },
      toUser: {
        select: { id: true, email: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return requests.map((r) => ({
    id: r.id,
    fromUserId: r.fromUser.id,
    fromUserEmail: r.fromUser.email,
    fromUserName: r.fromUser.name,
    toUserId: r.toUser.id,
    toUserEmail: r.toUser.email,
    toUserName: r.toUser.name,
    message: r.message,
    status: r.status,
    createdAt: r.createdAt,
    respondedAt: r.respondedAt,
  }));
}

/**
 * 보낸 친구 요청 목록 조회
 */
export async function getSentRequests(userId: string): Promise<FriendRequestInfo[]> {
  const requests = await prisma.friendRequest.findMany({
    where: {
      fromUserId: userId,
      status: 'PENDING',
    },
    include: {
      fromUser: {
        select: { id: true, email: true, name: true },
      },
      toUser: {
        select: { id: true, email: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return requests.map((r) => ({
    id: r.id,
    fromUserId: r.fromUser.id,
    fromUserEmail: r.fromUser.email,
    fromUserName: r.fromUser.name,
    toUserId: r.toUser.id,
    toUserEmail: r.toUser.email,
    toUserName: r.toUser.name,
    message: r.message,
    status: r.status,
    createdAt: r.createdAt,
    respondedAt: r.respondedAt,
  }));
}

/**
 * 친구 요청 수락
 */
export async function acceptRequest(requestId: string, userId: string): Promise<FriendRequestInfo> {
  const request = await prisma.friendRequest.findUnique({
    where: { id: requestId },
    include: {
      fromUser: { select: { id: true, email: true, name: true } },
      toUser: { select: { id: true, email: true, name: true } },
    },
  });

  if (!request) {
    throw new NotFoundError('Friend request not found');
  }

  if (request.toUserId !== userId) {
    throw new ValidationError('Not authorized to accept this request');
  }

  if (request.status !== 'PENDING') {
    throw new ValidationError('Request already processed');
  }

  // 트랜잭션: 요청 상태 업데이트 + 양방향 친구 관계 생성
  await prisma.$transaction([
    prisma.friendRequest.update({
      where: { id: requestId },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
      },
    }),
    prisma.friendship.create({
      data: {
        userId: request.fromUserId,
        friendId: request.toUserId,
        relationFlags: RelationFlags.FRIEND,
      },
    }),
    prisma.friendship.create({
      data: {
        userId: request.toUserId,
        friendId: request.fromUserId,
        relationFlags: RelationFlags.FRIEND,
      },
    }),
  ]);

  logger.info({ requestId, fromUserId: request.fromUserId, toUserId: request.toUserId }, 'Friend request accepted');

  return {
    id: request.id,
    fromUserId: request.fromUser.id,
    fromUserEmail: request.fromUser.email,
    fromUserName: request.fromUser.name,
    toUserId: request.toUser.id,
    toUserEmail: request.toUser.email,
    toUserName: request.toUser.name,
    message: request.message,
    status: 'ACCEPTED',
    createdAt: request.createdAt,
    respondedAt: new Date(),
  };
}

/**
 * 친구 요청 거절
 */
export async function rejectRequest(requestId: string, userId: string): Promise<FriendRequestInfo> {
  const request = await prisma.friendRequest.findUnique({
    where: { id: requestId },
    include: {
      fromUser: { select: { id: true, email: true, name: true } },
      toUser: { select: { id: true, email: true, name: true } },
    },
  });

  if (!request) {
    throw new NotFoundError('Friend request not found');
  }

  if (request.toUserId !== userId) {
    throw new ValidationError('Not authorized to reject this request');
  }

  if (request.status !== 'PENDING') {
    throw new ValidationError('Request already processed');
  }

  await prisma.friendRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      respondedAt: new Date(),
    },
  });

  logger.info({ requestId }, 'Friend request rejected');

  return {
    id: request.id,
    fromUserId: request.fromUser.id,
    fromUserEmail: request.fromUser.email,
    fromUserName: request.fromUser.name,
    toUserId: request.toUser.id,
    toUserEmail: request.toUser.email,
    toUserName: request.toUser.name,
    message: request.message,
    status: 'REJECTED',
    createdAt: request.createdAt,
    respondedAt: new Date(),
  };
}

/**
 * 보낸 친구 요청 취소
 */
export async function cancelSentRequest(requestId: string, userId: string): Promise<void> {
  const request = await prisma.friendRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new NotFoundError('Friend request not found');
  }

  if (request.fromUserId !== userId) {
    throw new ValidationError('Not authorized to cancel this request');
  }

  if (request.status !== 'PENDING') {
    throw new ValidationError('Request already processed');
  }

  await prisma.friendRequest.delete({
    where: { id: requestId },
  });

  logger.info({ requestId, userId }, 'Friend request cancelled');
}

/**
 * 친구 삭제 (양방향)
 */
export async function removeFriend(userId: string, friendId: string): Promise<void> {
  const friendship = await prisma.friendship.findUnique({
    where: {
      userId_friendId: { userId, friendId },
    },
  });

  if (!friendship) {
    throw new NotFoundError('Friendship not found');
  }

  // 양방향 삭제
  await prisma.$transaction([
    prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    }),
  ]);

  logger.info({ userId, friendId }, 'Friendship removed');
}

/**
 * 친구 관계 정보 수정 (관계 플래그, 그룹)
 */
export async function updateFriendship(
  userId: string,
  friendId: string,
  updates: { relationFlags?: number; groupId?: string | null }
): Promise<FriendInfo> {
  const friendship = await prisma.friendship.findUnique({
    where: {
      userId_friendId: { userId, friendId },
    },
  });

  if (!friendship) {
    throw new NotFoundError('Friendship not found');
  }

  // 그룹 존재 확인
  if (updates.groupId) {
    const group = await prisma.friendGroup.findUnique({
      where: { id: updates.groupId },
    });
    if (!group || group.userId !== userId) {
      throw new NotFoundError('Friend group not found');
    }
  }

  const updated = await prisma.friendship.update({
    where: { id: friendship.id },
    data: {
      relationFlags: updates.relationFlags ?? friendship.relationFlags,
      groupId: updates.groupId === null ? null : (updates.groupId ?? friendship.groupId),
    },
    include: {
      friend: { select: { id: true, email: true, name: true } },
      group: { select: { name: true } },
    },
  });

  return {
    id: updated.id,
    friendId: updated.friend.id,
    email: updated.friend.email,
    name: updated.friend.name,
    relationFlags: updated.relationFlags,
    groupId: updated.groupId,
    groupName: updated.group?.name ?? null,
    createdAt: updated.createdAt,
  };
}

// ============================================
// Friend Group Functions
// ============================================

/**
 * 친구 그룹 목록 조회
 */
export async function getFriendGroups(userId: string): Promise<FriendGroupInfo[]> {
  const groups = await prisma.friendGroup.findMany({
    where: { userId },
    include: {
      _count: {
        select: { friendships: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    friendCount: g._count.friendships,
    createdAt: g.createdAt,
  }));
}

/**
 * 친구 그룹 생성
 */
export async function createFriendGroup(userId: string, name: string, color?: string): Promise<FriendGroupInfo> {
  const existing = await prisma.friendGroup.findUnique({
    where: {
      userId_name: { userId, name },
    },
  });

  if (existing) {
    throw new ConflictError('Group with this name already exists');
  }

  const group = await prisma.friendGroup.create({
    data: {
      userId,
      name,
      color: color ?? null,
    },
  });

  logger.info({ userId, groupId: group.id, name }, 'Friend group created');

  return {
    id: group.id,
    name: group.name,
    color: group.color,
    friendCount: 0,
    createdAt: group.createdAt,
  };
}

/**
 * 친구 그룹 수정
 */
export async function updateFriendGroup(
  userId: string,
  groupId: string,
  updates: { name?: string; color?: string | null }
): Promise<FriendGroupInfo> {
  const group = await prisma.friendGroup.findUnique({
    where: { id: groupId },
  });

  if (!group || group.userId !== userId) {
    throw new NotFoundError('Friend group not found');
  }

  // 이름 중복 확인
  if (updates.name && updates.name !== group.name) {
    const existing = await prisma.friendGroup.findUnique({
      where: {
        userId_name: { userId, name: updates.name },
      },
    });
    if (existing) {
      throw new ConflictError('Group with this name already exists');
    }
  }

  const updated = await prisma.friendGroup.update({
    where: { id: groupId },
    data: {
      name: updates.name ?? group.name,
      color: updates.color === null ? null : (updates.color ?? group.color),
    },
    include: {
      _count: {
        select: { friendships: true },
      },
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    color: updated.color,
    friendCount: updated._count.friendships,
    createdAt: updated.createdAt,
  };
}

/**
 * 친구 그룹 삭제
 */
export async function deleteFriendGroup(userId: string, groupId: string): Promise<void> {
  const group = await prisma.friendGroup.findUnique({
    where: { id: groupId },
  });

  if (!group || group.userId !== userId) {
    throw new NotFoundError('Friend group not found');
  }

  await prisma.friendGroup.delete({
    where: { id: groupId },
  });

  logger.info({ userId, groupId }, 'Friend group deleted');
}

/**
 * 이메일로 사용자 검색 (친구 추가용)
 */
export async function searchUserByEmail(
  email: string,
  currentUserId: string
): Promise<{ id: string; email: string; name: string; isFriend: boolean } | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, isGuest: true },
  });

  if (!user || user.isGuest || user.id === currentUserId) {
    return null;
  }

  const friendship = await prisma.friendship.findUnique({
    where: {
      userId_friendId: { userId: currentUserId, friendId: user.id },
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isFriend: !!friendship,
  };
}
