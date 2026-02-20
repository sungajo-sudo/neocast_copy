/**
 * PaperInfo 서비스
 * - paper-info API 호출
 * - 캐시 조율 (메모리 → IndexedDB → API)
 * - 중복 다운로드 방지
 */

import type { NcodePageAddress } from '../types';
import type {
  SOBKey,
  CachedPaperInfo,
  PaperInfoResponse,
  NprojJson,
} from '../types/paper-info';
import { getSOBKeyFromAddress, createSOBKey } from '../types/paper-info';
import { nprojToJson, getPageSize, getNprojPageInfo } from '../utils/nprojUtils';
import { indexedDbService } from './indexeddb-service';
import { usePaperInfoStore } from '../stores/paper-info-store';
import { isMousePage } from '../types';

const API_BASE_URL = '/api/paperhub/paper-info';

class PaperInfoService {
  private initialized = false;

  /**
   * 서비스 초기화 (IndexedDB 연결)
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await indexedDbService.init();
    this.initialized = true;
  }

  /**
   * 페이지 주소에 대한 PaperInfo 요청
   * 캐시 우선순위: 메모리 → IndexedDB → API
   */
  async requestPaperInfo(
    address: NcodePageAddress
  ): Promise<CachedPaperInfo | null> {
    // 마우스 페이지는 paper-info가 없음
    if (isMousePage(address)) {
      return null;
    }

    const sobKey = getSOBKeyFromAddress(address);
    const store = usePaperInfoStore.getState();

    // 1. 메모리 캐시 확인
    const memCached = store.getCachedPaperInfo(sobKey);
    if (memCached && this.isPageInRange(address, memCached)) {
      console.debug('[PaperInfoService] Memory cache hit:', sobKey);
      return memCached;
    }

    // 2. 진행 중인 다운로드 확인 (중복 방지)
    const pendingDownload = store.getPendingDownload(sobKey);
    if (pendingDownload) {
      console.debug('[PaperInfoService] Waiting for pending download:', sobKey);
      return pendingDownload;
    }

    // 3. 새 다운로드 시작
    const downloadPromise = this.startDownload(sobKey, address);
    store.setPendingDownload(sobKey, downloadPromise);

    try {
      const result = await downloadPromise;
      return result;
    } finally {
      store.removePendingDownload(sobKey);
    }
  }

  /**
   * 다운로드 시작 (IndexedDB → API)
   */
  private async startDownload(
    sobKey: SOBKey,
    address: NcodePageAddress
  ): Promise<CachedPaperInfo | null> {
    await this.init();
    const store = usePaperInfoStore.getState();

    // IndexedDB 확인
    try {
      const storedInfo = await indexedDbService.getPaperInfo(sobKey);
      const storedBlob = await indexedDbService.getPdfBlob(sobKey);

      if (storedInfo && storedBlob) {
        // 페이지가 범위 내에 있는지 확인
        if (
          address.page >= storedInfo.startPage &&
          address.page <= storedInfo.endPage
        ) {
          console.debug('[PaperInfoService] IndexedDB cache hit:', sobKey);
          const cached: CachedPaperInfo = {
            sobKey,
            paperGroupId: storedInfo.paperGroupId,
            title: storedInfo.title,
            startPage: storedInfo.startPage,
            endPage: storedInfo.endPage,
            nprojJson: storedInfo.nprojJson,
            pdfBlob: storedBlob,
            cachedAt: storedInfo.cachedAt,
          };
          store.setCachedPaperInfo(sobKey, cached);
          return cached;
        }
      }
    } catch (e) {
      console.warn('[PaperInfoService] IndexedDB read error:', e);
    }

    // API 호출
    try {
      console.debug('[PaperInfoService] Fetching from API:', sobKey);
      const apiResponse = await this.fetchPaperInfoFromApi(address);

      if (!apiResponse) {
        console.warn('[PaperInfoService] API returned no data:', sobKey);
        return null;
      }

      // nproj URL 확인
      if (!apiResponse.nprojUrl) {
        console.warn('[PaperInfoService] No nproj URL in response:', sobKey);
        return null;
      }

      // PDF URL 확인
      if (!apiResponse.pdfUrl) {
        console.warn('[PaperInfoService] No PDF URL in response:', sobKey);
        return null;
      }

      // nproj와 PDF를 병렬로 다운로드
      const [nprojJson, pdfBlob] = await Promise.all([
        this.downloadNproj(apiResponse.nprojUrl),
        this.downloadPdf(apiResponse.pdfUrl),
      ]);

      if (!nprojJson) {
        console.warn('[PaperInfoService] Failed to download/parse NPROJ:', sobKey);
        return null;
      }

      if (!pdfBlob) {
        console.warn('[PaperInfoService] Failed to download PDF:', sobKey);
        return null;
      }

      // 캐시 저장
      const cached: CachedPaperInfo = {
        sobKey,
        paperGroupId: apiResponse.paperGroupId,
        title: apiResponse.title,
        startPage: apiResponse.start.page,
        endPage: apiResponse.end.page,
        nprojJson,
        pdfBlob,
        cachedAt: Date.now(),
      };

      // 메모리 캐시에 저장
      store.setCachedPaperInfo(sobKey, cached);

      // IndexedDB에 저장 (비동기, 실패해도 무시)
      indexedDbService
        .saveAll(
          sobKey,
          cached.paperGroupId,
          cached.title,
          cached.startPage,
          cached.endPage,
          cached.nprojJson,
          cached.pdfBlob
        )
        .catch((e) => {
          console.warn('[PaperInfoService] IndexedDB save error:', e);
        });

      console.debug('[PaperInfoService] Downloaded and cached:', sobKey);
      return cached;
    } catch (e) {
      console.error('[PaperInfoService] API fetch error:', e);
      return null;
    }
  }

  /**
   * paper-info API 호출
   */
  private async fetchPaperInfoFromApi(
    address: NcodePageAddress
  ): Promise<PaperInfoResponse | null> {
    const url = new URL(API_BASE_URL, window.location.origin);
    url.searchParams.set('section', String(address.section));
    url.searchParams.set('owner', String(address.owner));
    url.searchParams.set('book', String(address.book));
    url.searchParams.set('page', String(address.page));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.debug('[PaperInfoService] Paper not found:', address);
        return null;
      }
      throw new Error(`API error: ${response.status}`);
    }

    return response.json() as Promise<PaperInfoResponse>;
  }

  /**
   * NPROJ 파일 다운로드 및 파싱
   */
  private async downloadNproj(nprojUrl: string): Promise<NprojJson | null> {
    try {
      console.debug('[PaperInfoService] Downloading NPROJ:', nprojUrl);
      const response = await fetch(nprojUrl);
      if (!response.ok) {
        throw new Error(`NPROJ download error: ${response.status}`);
      }
      const nprojXml = await response.text();
      const nprojJson = nprojToJson(nprojXml);
      console.debug('[PaperInfoService] NPROJ downloaded and parsed');
      return nprojJson;
    } catch (e) {
      console.error('[PaperInfoService] NPROJ download error:', e);
      return null;
    }
  }

  /**
   * PDF 다운로드
   */
  private async downloadPdf(pdfUrl: string): Promise<Blob | null> {
    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`PDF download error: ${response.status}`);
      }
      return response.blob();
    } catch (e) {
      console.error('[PaperInfoService] PDF download error:', e);
      return null;
    }
  }

  /**
   * 페이지가 캐시된 범위 내에 있는지 확인
   */
  private isPageInRange(
    address: NcodePageAddress,
    cached: CachedPaperInfo
  ): boolean {
    return address.page >= cached.startPage && address.page <= cached.endPage;
  }

  /**
   * 캐시된 PaperInfo 조회 (동기)
   */
  getCachedPaperInfo(address: NcodePageAddress): CachedPaperInfo | null {
    if (isMousePage(address)) return null;
    const sobKey = getSOBKeyFromAddress(address);
    return usePaperInfoStore.getState().getCachedPaperInfo(sobKey);
  }

  /**
   * 페이지가 캐시되어 있는지 확인 (동기)
   */
  isPageCached(address: NcodePageAddress): boolean {
    if (isMousePage(address)) return false;
    const cached = this.getCachedPaperInfo(address);
    return cached !== null && this.isPageInRange(address, cached);
  }

  /**
   * 특정 SOB의 캐시 무효화
   */
  async invalidateCache(section: number, owner: number, book: number): Promise<void> {
    const sobKey = createSOBKey(section, owner, book);
    usePaperInfoStore.getState().removeCachedPaperInfo(sobKey);
    await indexedDbService.deleteAll(sobKey);
  }

  /**
   * 전체 캐시 클리어
   */
  async clearAllCache(): Promise<void> {
    usePaperInfoStore.getState().clearCache();
    await indexedDbService.clearAll();
  }

  /**
   * 페이지 크기 조회 (동기, 캐시에서만)
   * NPROJ에서 페이지 크기를 PU (= 72 DPI points) 단위로 반환
   * @returns { widthPt, heightPt } 또는 null (캐시 없거나 마우스 페이지)
   */
  getPageSizeInPoints(
    address: NcodePageAddress
  ): { widthPt: number; heightPt: number } | null {
    if (isMousePage(address)) return null;

    const cached = this.getCachedPaperInfo(address);
    if (!cached) return null;

    const size = getPageSize(cached.nprojJson, address.page);
    if (!size) return null;

    // PU = 1/72 inch = 1 point (72 DPI)
    return { widthPt: size.width, heightPt: size.height };
  }

  /**
   * 페이지의 crop margin 조회 (동기, 캐시에서만)
   * 스트로크 좌표 변환 시 이 값을 빼야 함
   * @returns { left, top, right, bottom } in PU 또는 null
   */
  getCropMarginInPoints(
    address: NcodePageAddress
  ): { left: number; top: number; right: number; bottom: number } | null {
    if (isMousePage(address)) return null;

    const cached = this.getCachedPaperInfo(address);
    if (!cached) return null;

    const pageInfo = getNprojPageInfo(cached.nprojJson, address.page);
    if (!pageInfo) return null;

    // crop_margin + whole.left/top이 실제 오프셋
    return {
      left: pageInfo.whole.x1 + pageInfo.crop_margin.left,
      top: pageInfo.whole.y1 + pageInfo.crop_margin.top,
      right: pageInfo.crop_margin.right,
      bottom: pageInfo.crop_margin.bottom,
    };
  }
}

// 싱글톤 인스턴스
export const paperInfoService = new PaperInfoService();
