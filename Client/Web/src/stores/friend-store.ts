import { create } from 'zustand';

// 프레즌스 상태 타입
export type PresenceStatus = 'online' | 'offline' | 'busy' | 'away';

// 관계 플래그 비트마스크
export const RelationFlags = {
  FRIEND: 1,
  TEACHER: 2,
  STUDENT: 4,
  PARENT: 8,
  CHILD: 16,
} as const;

/**
 * 친구 정보 타입
 */
export interface Friend {
  id: string;
  friendId: string;
  email: string;
  name: string;
  relationFlags: number;
  groupId: string | null;
  groupName: string | null;
  createdAt: string;
  // 온라인 상태
  status: PresenceStatus;
  lastSeen: number;
}

/**
 * 친구 요청 타입
 */
export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserEmail: string;
  fromUserName: string;
  toUserId: string;
  toUserEmail: string;
  toUserName: string;
  message: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  respondedAt: string | null;
}

/**
 * 친구 그룹 타입
 */
export interface FriendGroup {
  id: string;
  name: string;
  color: string | null;
  friendCount: number;
  createdAt: string;
}

/**
 * 친구 스토어 인터페이스
 */
interface FriendStore {
  // 상태
  friends: Friend[];
  receivedRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  groups: FriendGroup[];
  isLoading: boolean;
  isConnected: boolean;

  // 친구 목록 액션
  setFriends: (friends: Friend[]) => void;
  addFriend: (friend: Friend) => void;
  removeFriend: (friendId: string) => void;
  updateFriend: (friendId: string, updates: Partial<Friend>) => void;
  updateFriendStatus: (friendId: string, status: PresenceStatus, lastSeen?: number) => void;

  // 요청 액션
  setReceivedRequests: (requests: FriendRequest[]) => void;
  addReceivedRequest: (request: FriendRequest) => void;
  removeReceivedRequest: (requestId: string) => void;
  setSentRequests: (requests: FriendRequest[]) => void;
  addSentRequest: (request: FriendRequest) => void;
  removeSentRequest: (requestId: string) => void;

  // 그룹 액션
  setGroups: (groups: FriendGroup[]) => void;
  addGroup: (group: FriendGroup) => void;
  updateGroup: (groupId: string, updates: Partial<FriendGroup>) => void;
  removeGroup: (groupId: string) => void;

  // 유틸리티
  getFriendById: (friendId: string) => Friend | undefined;
  getFriendByUserId: (userId: string) => Friend | undefined;
  getOnlineFriends: () => Friend[];
  getReceivedRequestCount: () => number;

  // 상태
  setLoading: (loading: boolean) => void;
  setConnected: (connected: boolean) => void;

  // 리셋
  reset: () => void;
}

const initialState = {
  friends: [] as Friend[],
  receivedRequests: [] as FriendRequest[],
  sentRequests: [] as FriendRequest[],
  groups: [] as FriendGroup[],
  isLoading: false,
  isConnected: false,
};

export const useFriendStore = create<FriendStore>((set, get) => ({
  ...initialState,

  // 친구 목록
  setFriends: (friends) => set({ friends }),

  addFriend: (friend) => {
    set((state) => ({
      friends: [...state.friends, friend],
    }));
  },

  removeFriend: (friendId) => {
    set((state) => ({
      friends: state.friends.filter((f) => f.friendId !== friendId),
    }));
  },

  updateFriend: (friendId, updates) => {
    set((state) => ({
      friends: state.friends.map((f) => (f.friendId === friendId ? { ...f, ...updates } : f)),
    }));
  },

  updateFriendStatus: (friendId, status, lastSeen) => {
    set((state) => ({
      friends: state.friends.map((f) =>
        f.friendId === friendId
          ? { ...f, status, ...(lastSeen !== undefined ? { lastSeen } : {}) }
          : f
      ),
    }));
  },

  // 받은 요청
  setReceivedRequests: (requests) => set({ receivedRequests: requests }),

  addReceivedRequest: (request) => {
    set((state) => ({
      receivedRequests: [...state.receivedRequests, request],
    }));
  },

  removeReceivedRequest: (requestId) => {
    set((state) => ({
      receivedRequests: state.receivedRequests.filter((r) => r.id !== requestId),
    }));
  },

  // 보낸 요청
  setSentRequests: (requests) => set({ sentRequests: requests }),

  addSentRequest: (request) => {
    set((state) => ({
      sentRequests: [...state.sentRequests, request],
    }));
  },

  removeSentRequest: (requestId) => {
    set((state) => ({
      sentRequests: state.sentRequests.filter((r) => r.id !== requestId),
    }));
  },

  // 그룹
  setGroups: (groups) => set({ groups }),

  addGroup: (group) => {
    set((state) => ({
      groups: [...state.groups, group],
    }));
  },

  updateGroup: (groupId, updates) => {
    set((state) => ({
      groups: state.groups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)),
    }));
  },

  removeGroup: (groupId) => {
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
      // 해당 그룹에 속한 친구들의 그룹 정보 초기화
      friends: state.friends.map((f) =>
        f.groupId === groupId ? { ...f, groupId: null, groupName: null } : f
      ),
    }));
  },

  // 유틸리티
  getFriendById: (friendId) => {
    return get().friends.find((f) => f.id === friendId);
  },

  getFriendByUserId: (userId) => {
    return get().friends.find((f) => f.friendId === userId);
  },

  getOnlineFriends: () => {
    return get().friends.filter((f) => f.status !== 'offline');
  },

  getReceivedRequestCount: () => {
    return get().receivedRequests.length;
  },

  // 상태
  setLoading: (loading) => set({ isLoading: loading }),
  setConnected: (connected) => set({ isConnected: connected }),

  // 리셋
  reset: () => set(initialState),
}));
