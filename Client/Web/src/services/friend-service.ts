import { authService } from './auth-service';
import type { Friend, FriendRequest, FriendGroup } from '../stores/friend-store';
import { useFriendStore } from '../stores/friend-store';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

interface SearchUserResult {
  id: string;
  email: string;
  name: string;
  isFriend: boolean;
}

/**
 * 친구 관리 서비스
 * REST API를 통한 친구 관리 기능
 */
class FriendService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private getAccessToken(): string {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    return token;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();
    if (!response.ok) {
      const error = data as ApiError;
      throw new Error(error.message || 'Request failed');
    }
    return data as T;
  }

  // ============================================
  // 친구 관리
  // ============================================

  /**
   * 친구 목록 조회 (with 온라인 상태)
   */
  async getFriends(): Promise<Friend[]> {
    const response = await fetch(`${this.baseUrl}/friends`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
    const data = await this.handleResponse<{ success: boolean; friends: Friend[] }>(response);
    return data.friends;
  }

  /**
   * 친구 목록 로드 및 스토어 업데이트
   */
  async loadFriends(): Promise<void> {
    const store = useFriendStore.getState();
    store.setLoading(true);
    try {
      const friends = await this.getFriends();
      store.setFriends(friends);
    } finally {
      store.setLoading(false);
    }
  }

  /**
   * 이메일로 사용자 검색 (친구 추가용)
   */
  async searchUserByEmail(email: string): Promise<SearchUserResult | null> {
    const response = await fetch(`${this.baseUrl}/friends/search?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
    const data = await this.handleResponse<{ success: boolean; user: SearchUserResult | null }>(response);
    return data.user;
  }

  /**
   * 친구 요청 보내기
   */
  async sendFriendRequest(email: string, message?: string): Promise<FriendRequest> {
    const response = await fetch(`${this.baseUrl}/friends/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
      body: JSON.stringify({ email, message }),
    });
    const data = await this.handleResponse<{ success: boolean; request: FriendRequest }>(response);

    // 상대방이 이미 요청을 보낸 경우 자동 수락됨 - 친구 목록 새로고침
    if (data.request.status === 'ACCEPTED') {
      await this.loadFriends();
    } else {
      // 보낸 요청 목록에 추가
      useFriendStore.getState().addSentRequest(data.request);
    }

    return data.request;
  }

  /**
   * 받은 친구 요청 목록 조회
   */
  async getReceivedRequests(): Promise<FriendRequest[]> {
    const response = await fetch(`${this.baseUrl}/friends/requests`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
    const data = await this.handleResponse<{ success: boolean; requests: FriendRequest[] }>(response);
    return data.requests;
  }

  /**
   * 보낸 친구 요청 목록 조회
   */
  async getSentRequests(): Promise<FriendRequest[]> {
    const response = await fetch(`${this.baseUrl}/friends/requests/sent`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
    const data = await this.handleResponse<{ success: boolean; requests: FriendRequest[] }>(response);
    return data.requests;
  }

  /**
   * 요청 목록 로드 및 스토어 업데이트
   */
  async loadRequests(): Promise<void> {
    const store = useFriendStore.getState();
    const [received, sent] = await Promise.all([this.getReceivedRequests(), this.getSentRequests()]);
    store.setReceivedRequests(received);
    store.setSentRequests(sent);
  }

  /**
   * 친구 요청 수락
   */
  async acceptRequest(requestId: string): Promise<FriendRequest> {
    const response = await fetch(`${this.baseUrl}/friends/requests/${requestId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
      body: JSON.stringify({}),
    });
    const data = await this.handleResponse<{ success: boolean; request: FriendRequest }>(response);

    // 요청 목록에서 제거
    useFriendStore.getState().removeReceivedRequest(requestId);

    // 친구 목록 새로고침
    await this.loadFriends();

    return data.request;
  }

  /**
   * 친구 요청 거절
   */
  async rejectRequest(requestId: string): Promise<FriendRequest> {
    const response = await fetch(`${this.baseUrl}/friends/requests/${requestId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
      body: JSON.stringify({}),
    });
    const data = await this.handleResponse<{ success: boolean; request: FriendRequest }>(response);

    // 요청 목록에서 제거
    useFriendStore.getState().removeReceivedRequest(requestId);

    return data.request;
  }

  /**
   * 보낸 친구 요청 취소
   */
  async cancelSentRequest(requestId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/friends/requests/${requestId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
    await this.handleResponse<{ success: boolean; message: string }>(response);

    // 보낸 요청 목록에서 제거
    useFriendStore.getState().removeSentRequest(requestId);
  }

  /**
   * 친구 삭제
   */
  async removeFriend(friendId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/friends/${friendId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
    await this.handleResponse<{ success: boolean; message: string }>(response);

    // 친구 목록에서 제거
    useFriendStore.getState().removeFriend(friendId);
  }

  /**
   * 친구 관계 수정 (그룹, 관계 플래그)
   */
  async updateFriendship(
    friendId: string,
    updates: { relationFlags?: number; groupId?: string | null }
  ): Promise<Friend> {
    const response = await fetch(`${this.baseUrl}/friends/${friendId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
      body: JSON.stringify(updates),
    });
    const data = await this.handleResponse<{ success: boolean; friend: Friend }>(response);

    // 친구 정보 업데이트
    useFriendStore.getState().updateFriend(friendId, data.friend);

    return data.friend;
  }

  // ============================================
  // 친구 그룹 관리
  // ============================================

  /**
   * 친구 그룹 목록 조회
   */
  async getGroups(): Promise<FriendGroup[]> {
    const response = await fetch(`${this.baseUrl}/friend-groups`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
    const data = await this.handleResponse<{ success: boolean; groups: FriendGroup[] }>(response);
    return data.groups;
  }

  /**
   * 그룹 목록 로드 및 스토어 업데이트
   */
  async loadGroups(): Promise<void> {
    const groups = await this.getGroups();
    useFriendStore.getState().setGroups(groups);
  }

  /**
   * 친구 그룹 생성
   */
  async createGroup(name: string, color?: string): Promise<FriendGroup> {
    const response = await fetch(`${this.baseUrl}/friend-groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
      body: JSON.stringify({ name, color }),
    });
    const data = await this.handleResponse<{ success: boolean; group: FriendGroup }>(response);

    // 그룹 목록에 추가
    useFriendStore.getState().addGroup(data.group);

    return data.group;
  }

  /**
   * 친구 그룹 수정
   */
  async updateGroup(groupId: string, updates: { name?: string; color?: string | null }): Promise<FriendGroup> {
    const response = await fetch(`${this.baseUrl}/friend-groups/${groupId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
      body: JSON.stringify(updates),
    });
    const data = await this.handleResponse<{ success: boolean; group: FriendGroup }>(response);

    // 그룹 정보 업데이트
    useFriendStore.getState().updateGroup(groupId, data.group);

    return data.group;
  }

  /**
   * 친구 그룹 삭제
   */
  async deleteGroup(groupId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/friend-groups/${groupId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
    await this.handleResponse<{ success: boolean; message: string }>(response);

    // 그룹 목록에서 제거
    useFriendStore.getState().removeGroup(groupId);
  }

  // ============================================
  // 초기화
  // ============================================

  /**
   * 모든 데이터 로드
   */
  async loadAll(): Promise<void> {
    await Promise.all([this.loadFriends(), this.loadRequests(), this.loadGroups()]);
  }
}

// 싱글톤 인스턴스
export const friendService = new FriendService();
