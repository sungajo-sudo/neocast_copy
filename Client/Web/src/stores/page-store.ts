import { create } from 'zustand';
import type { NcodePageAddress } from '../types';
import {
  createMousePageAddress,
  isSamePageAddress,
  isMousePage,
  formatPageAddress,
} from '../types';

// 페이지 정보
export interface PageInfo {
  address: NcodePageAddress;
  ownerUserId: string; // 페이지 소유자 ID
  width: number; // mm
  height: number; // mm
  createdAt: number;
}

interface PageStore {
  // 상태
  pages: PageInfo[]; // 모든 페이지 (마우스 + 펜)
  currentPageAddress: NcodePageAddress; // 현재 페이지 주소

  // 마우스 페이지 카운터 (사용자별)
  mousePageCounters: Map<string, number>; // userId -> count

  // 액션
  addMousePage: (ownerUserId: string) => NcodePageAddress; // 마우스 페이지 추가
  addPage: (address: NcodePageAddress, ownerUserId: string, width?: number, height?: number) => void;
  deletePage: (address: NcodePageAddress, ownerUserId: string) => void; // 페이지 삭제
  setCurrentPage: (address: NcodePageAddress, ownerUserId?: string) => void;

  // 유틸리티
  getPage: (address: NcodePageAddress, ownerUserId: string) => PageInfo | undefined;
  getPagesByUser: (ownerUserId: string) => PageInfo[];
  getMousePageCount: (ownerUserId: string) => number;
  hasPage: (address: NcodePageAddress, ownerUserId: string) => boolean;

  // 초기화
  reset: () => void;
  initializeForUser: (userId: string) => NcodePageAddress | null; // 사용자용 초기 페이지 생성, 생성된 경우 주소 반환
}

// 기본 페이지 크기 (A4: 210 x 297 mm)
const DEFAULT_PAGE_WIDTH = 210;
const DEFAULT_PAGE_HEIGHT = 297;

// 초기 마우스 페이지 주소
const initialMousePage = createMousePageAddress(1);

export const usePageStore = create<PageStore>((set, get) => ({
  // 초기 상태
  pages: [],
  currentPageAddress: initialMousePage,
  mousePageCounters: new Map(),

  addMousePage: (ownerUserId: string) => {
    const { mousePageCounters, pages } = get();
    const currentCount = mousePageCounters.get(ownerUserId) || 0;
    const newPageNumber = currentCount + 1;
    const newAddress = createMousePageAddress(newPageNumber);

    const newPageInfo: PageInfo = {
      address: newAddress,
      ownerUserId,
      width: DEFAULT_PAGE_WIDTH,
      height: DEFAULT_PAGE_HEIGHT,
      createdAt: Date.now(),
    };

    const newCounters = new Map(mousePageCounters);
    newCounters.set(ownerUserId, newPageNumber);

    set({
      pages: [...pages, newPageInfo],
      mousePageCounters: newCounters,
      currentPageAddress: newAddress,
    });

    return newAddress;
  },

  addPage: (address, ownerUserId, width = DEFAULT_PAGE_WIDTH, height = DEFAULT_PAGE_HEIGHT) => {
    const { pages, hasPage, mousePageCounters } = get();

    // 이미 존재하면 무시 (같은 소유자, 같은 주소)
    if (hasPage(address, ownerUserId)) return;

    const newPageInfo: PageInfo = {
      address,
      ownerUserId,
      width,
      height,
      createdAt: Date.now(),
    };

    set({ pages: [...pages, newPageInfo] });

    // 마우스 페이지면 카운트 업데이트
    if (isMousePage(address)) {
      const currentCount = mousePageCounters.get(ownerUserId) || 0;
      if (address.page > currentCount) {
        const newCounters = new Map(mousePageCounters);
        newCounters.set(ownerUserId, address.page);
        set({ mousePageCounters: newCounters });
      }
    }
  },

  deletePage: (address, ownerUserId) => {
    const { pages, currentPageAddress } = get();

    // 페이지 삭제
    const newPages = pages.filter(
      (p) => !(isSamePageAddress(p.address, address) && p.ownerUserId === ownerUserId)
    );

    // 삭제할 페이지가 현재 페이지면 다른 페이지로 이동
    let newCurrentPage = currentPageAddress;
    if (isSamePageAddress(currentPageAddress, address)) {
      const userPages = newPages.filter((p) => p.ownerUserId === ownerUserId);
      if (userPages.length > 0) {
        newCurrentPage = userPages[0].address;
      } else {
        // 페이지가 없으면 기본 마우스 페이지 1로
        newCurrentPage = createMousePageAddress(1);
      }
    }

    set({ pages: newPages, currentPageAddress: newCurrentPage });
  },

  setCurrentPage: (address, ownerUserId) => {
    const { pages, hasPage, mousePageCounters } = get();

    // ownerUserId가 제공되고 페이지가 없으면 자동으로 추가
    if (ownerUserId && !hasPage(address, ownerUserId)) {
      const newPageInfo: PageInfo = {
        address,
        ownerUserId,
        width: DEFAULT_PAGE_WIDTH,
        height: DEFAULT_PAGE_HEIGHT,
        createdAt: Date.now(),
      };

      const newPages = [...pages, newPageInfo];
      let newCounters = mousePageCounters;

      // 마우스 페이지면 카운트 업데이트
      if (isMousePage(address)) {
        const currentCount = mousePageCounters.get(ownerUserId) || 0;
        if (address.page > currentCount) {
          newCounters = new Map(mousePageCounters);
          newCounters.set(ownerUserId, address.page);
        }
      }

      set({
        pages: newPages,
        currentPageAddress: address,
        mousePageCounters: newCounters,
      });
    } else {
      set({ currentPageAddress: address });
    }
  },

  getPage: (address, ownerUserId) => {
    return get().pages.find(
      (p) => isSamePageAddress(p.address, address) && p.ownerUserId === ownerUserId
    );
  },

  getPagesByUser: (ownerUserId) => {
    return get().pages
      .filter((p) => p.ownerUserId === ownerUserId)
      .sort((a, b) => {
        // 마우스 페이지 먼저, 펜 페이지 나중
        const aIsMouse = isMousePage(a.address);
        const bIsMouse = isMousePage(b.address);
        if (aIsMouse && !bIsMouse) return -1;
        if (!aIsMouse && bIsMouse) return 1;
        return a.createdAt - b.createdAt;
      });
  },

  getMousePageCount: (ownerUserId) => {
    return get().mousePageCounters.get(ownerUserId) || 0;
  },

  hasPage: (address, ownerUserId) => {
    return get().pages.some(
      (p) => isSamePageAddress(p.address, address) && p.ownerUserId === ownerUserId
    );
  },

  reset: () => {
    set({
      pages: [],
      currentPageAddress: initialMousePage,
      mousePageCounters: new Map(),
    });
  },

  initializeForUser: (userId) => {
    const { pages, hasPage, mousePageCounters } = get();
    const initialAddress = createMousePageAddress(1);

    // 이미 해당 사용자의 초기 페이지가 있으면 무시
    if (hasPage(initialAddress, userId)) return null;

    const newPageInfo: PageInfo = {
      address: initialAddress,
      ownerUserId: userId,
      width: DEFAULT_PAGE_WIDTH,
      height: DEFAULT_PAGE_HEIGHT,
      createdAt: Date.now(),
    };

    const newCounters = new Map(mousePageCounters);
    newCounters.set(userId, 1);

    set({
      pages: [...pages, newPageInfo],
      mousePageCounters: newCounters,
    });

    console.log('[PageStore] Initial page created for user:', userId, formatPageAddress(initialAddress));
    return initialAddress;
  },
}));

// 디버그용 로거
if (import.meta.env.DEV) {
  usePageStore.subscribe((state) => {
    console.log('[PageStore] Current page:', formatPageAddress(state.currentPageAddress), 'Total pages:', state.pages.length);
  });
}
