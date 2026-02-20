/**
 * PaperInfo 상태 관리 스토어
 * - 메모리 캐시
 * - 다운로드 큐 관리
 * - 중복 다운로드 방지
 */

import { create } from 'zustand';
import type { NcodePageAddress } from '../types';
import type {
  SOBKey,
  CachedPaperInfo,
  DownloadQueueItem,
  NprojJson,
} from '../types/paper-info';
import { getSOBKeyFromAddress } from '../types/paper-info';

interface PaperInfoState {
  // 메모리 캐시 (SOBKey → CachedPaperInfo)
  cache: Map<SOBKey, CachedPaperInfo>;

  // 진행 중인 다운로드 Promise (중복 방지)
  pendingDownloads: Map<SOBKey, Promise<CachedPaperInfo | null>>;

  // 다운로드 큐 (대기 중인 요청)
  downloadQueue: Map<SOBKey, DownloadQueueItem>;

  // 액션
  getCachedPaperInfo: (sobKey: SOBKey) => CachedPaperInfo | null;
  setCachedPaperInfo: (sobKey: SOBKey, info: CachedPaperInfo) => void;
  removeCachedPaperInfo: (sobKey: SOBKey) => void;
  isInCache: (address: NcodePageAddress) => boolean;
  isPageInCachedRange: (address: NcodePageAddress) => boolean;

  // 다운로드 관리
  getPendingDownload: (sobKey: SOBKey) => Promise<CachedPaperInfo | null> | null;
  setPendingDownload: (
    sobKey: SOBKey,
    promise: Promise<CachedPaperInfo | null>
  ) => void;
  removePendingDownload: (sobKey: SOBKey) => void;
  hasPendingDownload: (sobKey: SOBKey) => boolean;

  // 큐 관리
  addToQueue: (item: DownloadQueueItem) => void;
  removeFromQueue: (sobKey: SOBKey) => void;
  getQueueItem: (sobKey: SOBKey) => DownloadQueueItem | null;
  updateQueueItemStatus: (
    sobKey: SOBKey,
    status: DownloadQueueItem['status']
  ) => void;

  // 유틸리티
  clearCache: () => void;
  getPageInfo: (
    address: NcodePageAddress
  ) => { nprojJson: NprojJson; pdfBlob: Blob } | null;
}

export const usePaperInfoStore = create<PaperInfoState>((set, get) => ({
  cache: new Map(),
  pendingDownloads: new Map(),
  downloadQueue: new Map(),

  // ============================================
  // 캐시 관리
  // ============================================

  getCachedPaperInfo: (sobKey: SOBKey) => {
    return get().cache.get(sobKey) || null;
  },

  setCachedPaperInfo: (sobKey: SOBKey, info: CachedPaperInfo) => {
    set((state) => {
      const newCache = new Map(state.cache);
      newCache.set(sobKey, info);
      return { cache: newCache };
    });
  },

  removeCachedPaperInfo: (sobKey: SOBKey) => {
    set((state) => {
      const newCache = new Map(state.cache);
      newCache.delete(sobKey);
      return { cache: newCache };
    });
  },

  isInCache: (address: NcodePageAddress) => {
    const sobKey = getSOBKeyFromAddress(address);
    return get().cache.has(sobKey);
  },

  isPageInCachedRange: (address: NcodePageAddress) => {
    const sobKey = getSOBKeyFromAddress(address);
    const cached = get().cache.get(sobKey);
    if (!cached) return false;
    return address.page >= cached.startPage && address.page <= cached.endPage;
  },

  // ============================================
  // 다운로드 관리
  // ============================================

  getPendingDownload: (sobKey: SOBKey) => {
    return get().pendingDownloads.get(sobKey) || null;
  },

  setPendingDownload: (sobKey: SOBKey, promise: Promise<CachedPaperInfo | null>) => {
    set((state) => {
      const newPending = new Map(state.pendingDownloads);
      newPending.set(sobKey, promise);
      return { pendingDownloads: newPending };
    });
  },

  removePendingDownload: (sobKey: SOBKey) => {
    set((state) => {
      const newPending = new Map(state.pendingDownloads);
      newPending.delete(sobKey);
      return { pendingDownloads: newPending };
    });
  },

  hasPendingDownload: (sobKey: SOBKey) => {
    return get().pendingDownloads.has(sobKey);
  },

  // ============================================
  // 큐 관리
  // ============================================

  addToQueue: (item: DownloadQueueItem) => {
    set((state) => {
      const newQueue = new Map(state.downloadQueue);
      newQueue.set(item.sobKey, item);
      return { downloadQueue: newQueue };
    });
  },

  removeFromQueue: (sobKey: SOBKey) => {
    set((state) => {
      const newQueue = new Map(state.downloadQueue);
      newQueue.delete(sobKey);
      return { downloadQueue: newQueue };
    });
  },

  getQueueItem: (sobKey: SOBKey) => {
    return get().downloadQueue.get(sobKey) || null;
  },

  updateQueueItemStatus: (sobKey: SOBKey, status: DownloadQueueItem['status']) => {
    set((state) => {
      const newQueue = new Map(state.downloadQueue);
      const item = newQueue.get(sobKey);
      if (item) {
        newQueue.set(sobKey, { ...item, status });
      }
      return { downloadQueue: newQueue };
    });
  },

  // ============================================
  // 유틸리티
  // ============================================

  clearCache: () => {
    set({
      cache: new Map(),
      pendingDownloads: new Map(),
      downloadQueue: new Map(),
    });
  },

  getPageInfo: (address: NcodePageAddress) => {
    const sobKey = getSOBKeyFromAddress(address);
    const cached = get().cache.get(sobKey);
    if (!cached) return null;
    if (address.page < cached.startPage || address.page > cached.endPage) {
      return null;
    }
    return {
      nprojJson: cached.nprojJson,
      pdfBlob: cached.pdfBlob,
    };
  },
}));

// ============================================
// 셀렉터
// ============================================

/**
 * 페이지 주소에 대한 캐시 상태를 반환하는 셀렉터
 */
export const selectCachedPaperInfo = (address: NcodePageAddress) => {
  return usePaperInfoStore.getState().getCachedPaperInfo(
    getSOBKeyFromAddress(address)
  );
};

/**
 * 페이지가 캐시된 범위 내에 있는지 확인하는 셀렉터
 */
export const selectIsPageCached = (address: NcodePageAddress) => {
  return usePaperInfoStore.getState().isPageInCachedRange(address);
};
