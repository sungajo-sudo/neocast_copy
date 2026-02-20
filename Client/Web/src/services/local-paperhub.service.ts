/**
 * Local PaperHub Service
 *
 * IndexedDB 기반의 로컬 Paper 저장소
 * - hostId별 Paper 저장/조회
 * - ncode-pdf compound 저장
 * - NcPaperHub API와 동일한 인터페이스 제공
 */

import type { SOBKey, NprojJson } from '../types/paper-info';
import { createSOBKey } from '../types/paper-info';

// ============================================
// Constants
// ============================================

const DB_NAME = 'NeoCastLocalPaperHub';
const DB_VERSION = 1;

// Object Store Names
const STORE_PAPERS = 'papers';

// ============================================
// Types
// ============================================

/**
 * 저장된 Paper 정보
 */
export interface LocalPaper {
  /** Primary key: hostId + paperGroupId */
  key: string;
  /** 호스트(생성자) ID */
  hostId: string;
  /** Paper Group ID */
  paperGroupId: string;
  /** Section.Owner.Book 키 */
  sobKey: SOBKey;
  /** 문서 제목 */
  title: string;
  /** Section */
  section: number;
  /** Owner */
  owner: number;
  /** Book */
  book: number;
  /** 시작 페이지 */
  pageStart: number;
  /** 끝 페이지 */
  pageEnd: number;
  /** 총 페이지 수 */
  pageCount: number;
  /** NPROJ XML 내용 */
  nprojXml: string;
  /** 파싱된 NPROJ JSON (선택) */
  nprojJson?: NprojJson;
  /** PDF Blob */
  pdfBlob: Blob;
  /** 생성 시간 */
  createdAt: number;
}

/**
 * ncode-pdf compound 포맷
 * - 채팅으로 공유되는 파일 형식
 */
export interface NcodePdfCompound {
  /** 버전 */
  version: string;
  /** 호스트(생성자) ID */
  hostId: string;
  /** 호스트 이름 */
  hostName: string;
  /** Paper Group ID */
  paperGroupId: string;
  /** 문서 제목 */
  title: string;
  /** SOBP 정보 */
  sobp: {
    section: number;
    owner: number;
    book: number;
    pageStart: number;
    pageEnd: number;
  };
  /** 총 페이지 수 */
  pageCount: number;
  /** NPROJ XML 내용 */
  nprojXml: string;
  /** PDF Base64 인코딩 */
  pdfBase64: string;
  /** 생성 시간 (ISO 8601) */
  createdAt: string;
}

/**
 * Paper 저장 요청
 */
export interface SavePaperRequest {
  hostId: string;
  paperGroupId: string;
  sobKey: SOBKey;
  title: string;
  section: number;
  owner: number;
  book: number;
  pageStart: number;
  pageEnd: number;
  pageCount: number;
  nprojXml: string;
  pdfBlob: Blob;
}

// ============================================
// LocalPaperHubService Class
// ============================================

class LocalPaperHubService {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<void>;
  private resolveDbReady: (() => void) | null = null;
  private rejectDbReady: ((error: Error) => void) | null = null;

  constructor() {
    this.dbReady = new Promise((resolve, reject) => {
      this.resolveDbReady = resolve;
      this.rejectDbReady = reject;
    });
    this.initDatabase();
  }

  // ============================================
  // Database Initialization
  // ============================================

  private initDatabase(): void {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      const error = (event.target as IDBOpenDBRequest).error;
      console.error('[LocalPaperHub] Database error:', error);
      this.rejectDbReady?.(error || new Error('Database open failed'));
    };

    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result;
      console.log('[LocalPaperHub] Database opened successfully (v' + DB_VERSION + ')');
      this.resolveDbReady?.();
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log('[LocalPaperHub] Creating database schema...');

      // Papers store: key = hostId + paperGroupId
      if (!db.objectStoreNames.contains(STORE_PAPERS)) {
        const papersStore = db.createObjectStore(STORE_PAPERS, { keyPath: 'key' });
        papersStore.createIndex('hostId', 'hostId', { unique: false });
        papersStore.createIndex('paperGroupId', 'paperGroupId', { unique: false });
        papersStore.createIndex('hostId_sobKey', ['hostId', 'sobKey'], { unique: false });
        papersStore.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('[LocalPaperHub] Created papers store');
      }

      console.log('[LocalPaperHub] Database schema created');
    };
  }

  private async ensureDb(): Promise<IDBDatabase> {
    await this.dbReady;
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  // ============================================
  // Key Generation
  // ============================================

  /**
   * Paper 키 생성 (hostId + paperGroupId)
   */
  private createPaperKey(hostId: string, paperGroupId: string): string {
    return `${hostId}:${paperGroupId}`;
  }

  // ============================================
  // Paper Storage Operations
  // ============================================

  /**
   * Paper 저장
   */
  async savePaper(request: SavePaperRequest): Promise<void> {
    const db = await this.ensureDb();
    const key = this.createPaperKey(request.hostId, request.paperGroupId);

    const paper: LocalPaper = {
      key,
      hostId: request.hostId,
      paperGroupId: request.paperGroupId,
      sobKey: request.sobKey,
      title: request.title,
      section: request.section,
      owner: request.owner,
      book: request.book,
      pageStart: request.pageStart,
      pageEnd: request.pageEnd,
      pageCount: request.pageCount,
      nprojXml: request.nprojXml,
      pdfBlob: request.pdfBlob,
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PAPERS], 'readwrite');
      const store = transaction.objectStore(STORE_PAPERS);
      const putRequest = store.put(paper);

      transaction.oncomplete = () => {
        console.log('[LocalPaperHub] Paper saved:', { key, title: request.title });
        resolve();
      };

      transaction.onerror = () => {
        console.error('[LocalPaperHub] Error saving paper:', transaction.error);
        reject(transaction.error);
      };

      putRequest.onerror = () => {
        reject(putRequest.error);
      };
    });
  }

  /**
   * Compound에서 Paper 저장
   */
  async savePaperFromCompound(compound: NcodePdfCompound): Promise<void> {
    // Base64 디코딩하여 Blob 생성
    const binaryString = atob(compound.pdfBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const pdfBlob = new Blob([bytes], { type: 'application/pdf' });

    await this.savePaper({
      hostId: compound.hostId,
      paperGroupId: compound.paperGroupId,
      sobKey: createSOBKey(compound.sobp.section, compound.sobp.owner, compound.sobp.book),
      title: compound.title,
      section: compound.sobp.section,
      owner: compound.sobp.owner,
      book: compound.sobp.book,
      pageStart: compound.sobp.pageStart,
      pageEnd: compound.sobp.pageEnd,
      pageCount: compound.pageCount,
      nprojXml: compound.nprojXml,
      pdfBlob,
    });
  }

  /**
   * Paper 조회 (hostId + paperGroupId)
   */
  async getPaper(hostId: string, paperGroupId: string): Promise<LocalPaper | null> {
    const db = await this.ensureDb();
    const key = this.createPaperKey(hostId, paperGroupId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PAPERS], 'readonly');
      const store = transaction.objectStore(STORE_PAPERS);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Paper 조회 (hostId + SOBKey)
   */
  async getPaperBySOBKey(hostId: string, sobKey: SOBKey): Promise<LocalPaper | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PAPERS], 'readonly');
      const store = transaction.objectStore(STORE_PAPERS);
      const index = store.index('hostId_sobKey');
      const request = index.get([hostId, sobKey]);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Paper 조회 (hostId + section.owner.book.page로 조회)
   * - 페이지 범위 확인
   */
  async getPaperByAddress(
    hostId: string,
    section: number,
    owner: number,
    book: number,
    page: number
  ): Promise<LocalPaper | null> {
    const sobKey = createSOBKey(section, owner, book);
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PAPERS], 'readonly');
      const store = transaction.objectStore(STORE_PAPERS);
      const index = store.index('hostId_sobKey');
      const request = index.getAll([hostId, sobKey]);

      request.onsuccess = () => {
        const papers: LocalPaper[] = request.result || [];
        // 페이지 범위에 맞는 paper 찾기
        const matchingPaper = papers.find(
          (paper) => page >= paper.pageStart && page <= paper.pageEnd
        );
        resolve(matchingPaper || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 호스트의 모든 Paper 목록 조회
   */
  async getPapersByHost(hostId: string): Promise<LocalPaper[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PAPERS], 'readonly');
      const store = transaction.objectStore(STORE_PAPERS);
      const index = store.index('hostId');
      const request = index.getAll(hostId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 모든 Paper 목록 조회
   */
  async getAllPapers(): Promise<LocalPaper[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PAPERS], 'readonly');
      const store = transaction.objectStore(STORE_PAPERS);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Paper 존재 여부 확인
   */
  async hasPaper(hostId: string, paperGroupId: string): Promise<boolean> {
    const paper = await this.getPaper(hostId, paperGroupId);
    return paper !== null;
  }

  /**
   * Paper 삭제
   */
  async deletePaper(hostId: string, paperGroupId: string): Promise<boolean> {
    const db = await this.ensureDb();
    const key = this.createPaperKey(hostId, paperGroupId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PAPERS], 'readwrite');
      const store = transaction.objectStore(STORE_PAPERS);
      const request = store.delete(key);

      request.onsuccess = () => {
        console.log('[LocalPaperHub] Paper deleted:', key);
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // ============================================
  // Compound Operations
  // ============================================

  /**
   * Paper를 ncode-pdf compound로 변환
   */
  async createCompound(
    hostId: string,
    hostName: string,
    paperGroupId: string
  ): Promise<NcodePdfCompound | null> {
    const paper = await this.getPaper(hostId, paperGroupId);
    if (!paper) {
      return null;
    }

    // PDF Blob을 Base64로 변환
    const pdfBuffer = await paper.pdfBlob.arrayBuffer();
    const pdfBase64 = this.arrayBufferToBase64(pdfBuffer);

    return {
      version: '1.0',
      hostId: paper.hostId,
      hostName,
      paperGroupId: paper.paperGroupId,
      title: paper.title,
      sobp: {
        section: paper.section,
        owner: paper.owner,
        book: paper.book,
        pageStart: paper.pageStart,
        pageEnd: paper.pageEnd,
      },
      pageCount: paper.pageCount,
      nprojXml: paper.nprojXml,
      pdfBase64,
      createdAt: new Date(paper.createdAt).toISOString(),
    };
  }

  /**
   * Compound를 Blob으로 변환 (다운로드용)
   */
  compoundToBlob(compound: NcodePdfCompound): Blob {
    const json = JSON.stringify(compound, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Blob에서 Compound 파싱
   */
  async parseCompoundFromBlob(blob: Blob): Promise<NcodePdfCompound> {
    const text = await blob.text();
    return JSON.parse(text) as NcodePdfCompound;
  }

  /**
   * .np2 파일 다운로드
   * 파일명 형식: {title}-{section}_{owner}_{book}_{pageStart}-{pageEnd}.np2
   */
  downloadCompound(compound: NcodePdfCompound, filename?: string): void {
    const blob = this.compoundToBlob(compound);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || this.generateNp2Filename(compound);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * NP2 파일명 생성
   * 형식: {title}-{section}_{owner}_{book}_{pageStart}-{pageEnd}.np2
   */
  generateNp2Filename(compound: NcodePdfCompound): string {
    const { title, sobp } = compound;
    const { section, owner, book, pageStart, pageEnd } = sobp;
    const safeName = title.replace(/[^a-zA-Z0-9가-힣\s_-]/g, '').trim();
    return `${safeName}-${section}_${owner}_${book}_${pageStart}-${pageEnd}.np2`;
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * ArrayBuffer를 Base64 문자열로 변환
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * 전체 데이터 삭제 (테스트/리셋용)
   */
  async clearAllData(): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PAPERS], 'readwrite');
      const store = transaction.objectStore(STORE_PAPERS);
      const request = store.clear();

      transaction.oncomplete = () => {
        console.log('[LocalPaperHub] All data cleared');
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 캐시 통계 조회
   */
  async getStats(): Promise<{ count: number; totalSizeBytes: number }> {
    const papers = await this.getAllPapers();
    let totalSize = 0;
    for (const paper of papers) {
      if (paper.pdfBlob) {
        totalSize += paper.pdfBlob.size;
      }
    }
    return {
      count: papers.length,
      totalSizeBytes: totalSize,
    };
  }
}

// 싱글톤 인스턴스
export const localPaperHubService = new LocalPaperHubService();
