import axios from 'axios';
import { useAuthStore } from '../store/auth';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post<{ user: User; tokens: { accessToken: string; refreshToken: string } }>('/auth/login', {
      email,
      password,
    });
    return { token: data.tokens.accessToken, user: data.user };
  },
  register: async (email: string, password: string, name: string) => {
    const { data } = await api.post<{ user: User }>('/auth/register', {
      email,
      password,
      name,
    });
    return data;
  },
};

// Admin API
export const adminApi = {
  getStats: async () => {
    const { data } = await api.get<{ success: boolean; stats: AdminStats }>('/admin/stats');
    return data.stats;
  },
  getTimeseries: async (range: TimeseriesRange = '24h') => {
    const { data } = await api.get<{ success: boolean; range: string; data: TimeseriesData[] }>(
      `/admin/stats/timeseries?range=${range}`
    );
    return data.data;
  },
  getSessions: async () => {
    const { data } = await api.get<{ success: boolean; sessions: SessionInfo[] }>('/admin/sessions?limit=500');
    return data.sessions;
  },
  getSession: async (id: string) => {
    const { data } = await api.get<{ success: boolean; session: AdminSessionDetail }>(`/admin/sessions/${id}`);
    return data.session;
  },
  closeSession: async (id: string) => {
    const { data } = await api.post<{ success: boolean; message: string }>(`/admin/sessions/${id}/close`);
    return data;
  },
  // New stats APIs
  getUserStats: async (period: StatsPeriod = 'cumulative') => {
    const { data } = await api.get<{ success: boolean; stats: UserStats }>(`/admin/stats/users?period=${period}`);
    return data.stats;
  },
  getNcodeStats: async (period: StatsPeriod = 'cumulative') => {
    const { data } = await api.get<{ success: boolean; stats: NcodeStats }>(`/admin/stats/ncode?period=${period}`);
    return data.stats;
  },
  getNcodeRanking: async (limit = 20, offset = 0) => {
    const { data } = await api.get<{ success: boolean; data: NcodeRankingItem[]; pagination: Pagination }>(
      `/admin/stats/ncode/ranking?limit=${limit}&offset=${offset}`
    );
    return data;
  },
  getChatStats: async (period: StatsPeriod = 'cumulative') => {
    const { data } = await api.get<{ success: boolean; stats: ChatStats }>(`/admin/stats/chat?period=${period}`);
    return data.stats;
  },
  getMessengerStats: async (period: StatsPeriod = 'cumulative') => {
    const { data } = await api.get<{ success: boolean; stats: MessengerStats }>(`/admin/stats/messenger?period=${period}`);
    return data.stats;
  },
  getStorageDetailed: async (period: StatsPeriod = 'cumulative') => {
    const { data } = await api.get<{ success: boolean; stats: StorageDetailedStats }>(`/admin/stats/storage-detailed?period=${period}`);
    return data.stats;
  },
  getPapers: async (limit = 20, offset = 0) => {
    const { data } = await api.get<{ success: boolean; data: PaperInfo[]; pagination: Pagination }>(
      `/admin/papers?limit=${limit}&offset=${offset}`
    );
    return data;
  },
  getPaper: async (id: string) => {
    const { data } = await api.get<{ success: boolean; paper: PaperDetail }>(`/admin/papers/${id}`);
    return data.paper;
  },
  getPaperPreview: async (id: string) => {
    const { data } = await api.get<{ success: boolean; previewUrl: string }>(`/admin/papers/${id}/preview`);
    return data.previewUrl;
  },
};

// Sessions API
export const sessionsApi = {
  list: async () => {
    const { data } = await api.get<SessionInfo[]>('/sessions');
    return data;
  },
  get: async (id: string) => {
    const { data } = await api.get<SessionDetail>(`/sessions/${id}`);
    return data;
  },
  close: async (id: string) => {
    const { data } = await api.post<{ archiveId?: string }>(`/sessions/${id}/close`);
    return data;
  },
};

// Archives API
export const archivesApi = {
  list: async () => {
    const { data } = await api.get<{ success: boolean; archives: ArchiveInfo[] }>('/admin/archives');
    return data.archives;
  },
  get: async (id: string) => {
    const { data } = await api.get<{ success: boolean; archive: ArchiveDetail }>(`/admin/archives/${id}`);
    return data.archive;
  },
  delete: async (id: string) => {
    await api.delete(`/admin/archives/${id}`);
  },
  restore: async (id: string) => {
    const { data } = await api.post<{ success: boolean; sessionId: string; code: string }>(`/admin/archives/${id}/restore`);
    return data;
  },
};

// Types
export type TimeseriesRange = '24h' | '7d' | '30d' | '12m';
export type StatsPeriod = 'cumulative' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Pagination {
  limit: number;
  offset: number;
  total: number;
}

export interface UserStats {
  period: string;
  registeredUsers: number;
  loginCount: number;
  averageSessionDuration: number;
  averageSessionDurationFormatted: string;
}

export interface NcodeStats {
  period: string;
  totalPages: number;
  registeredPapers: number;
  uniqueCustomers: number;
}

export interface NcodeRankingItem {
  userId: string;
  userName: string;
  userEmail: string;
  paperCount: number;
  totalPages: number;
}

export interface ChatStats {
  period: string;
  messageCount: number;
  attachmentCount: number;
  attachmentStorageBytes: number;
  attachmentStorageFormatted: string;
}

export interface MessengerStats {
  period: string;
  dmMessageCount: number;
  activeThreads: number;
  totalFriendships: number;
}

export interface StorageDetailedStats {
  period: string;
  totalPdfCount: number;
  totalPdfSizeBytes: number;
  totalPdfSizeFormatted: string;
  averagePdfSizeBytes: number;
  averagePdfSizeFormatted: string;
}

export interface PaperInfo {
  id: string;
  title: string;
  pageCount: number;
  pdfSize: number;
  section: number;
  owner: number;
  book: number;
  pageStart: number;
  pageEnd: number;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface PaperDetail extends PaperInfo {
  pdfPath: string;
  nprojXml: string | null;
}

export interface TimeseriesData {
  name: string;
  sessions: number;
  strokes: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AdminStats {
  activeSessions: number;
  totalUsers: number;
  totalStrokes: number;
  totalArchives: number;
  activeParticipants: number;
  todaySessions: number;
  dau: number;
  wau: number;
  mau: number;
  yau: number;
}

export interface SessionInfo {
  id: string;
  code: string;
  hostName: string;
  hostEmail: string;
  status: 'ACTIVE' | 'PAUSED' | 'CLOSED' | 'ARCHIVED';
  participantCount: number;
  isHostOnline: boolean;
  strokeCount: number;
  createdAt: string;
}

export interface SessionDetail extends SessionInfo {
  participants: {
    id: string;
    name: string;
    email: string;
    role: 'HOST' | 'GUEST';
    joinedAt: string;
  }[];
  maxGuests: number;
  allowGuestVoice: boolean;
  autoArchive: boolean;
}

export interface AdminSessionDetail {
  id: string;
  code: string;
  status: 'ACTIVE' | 'PAUSED' | 'CLOSED' | 'ARCHIVED';
  createdAt: string;
  host: {
    id: string;
    name: string;
    email: string;
  };
  participants: {
    id: string;
    role: 'HOST' | 'GUEST';
    joinedAt: string;
    leftAt: string | null;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }[];
  strokeCount: number;
  duration: number;
}

export interface ArchiveInfo {
  id: string;
  hostName: string;
  totalStrokes: number;
  totalPages: number;
  duration: number;
  hasLinkedPrev: boolean;
  createdAt: string;
}

export interface ArchiveDetail extends ArchiveInfo {
  originalSessionId: string;
  linkedPrevId: string | null;
}

export default api;
