/**
 * IndexedDB 서비스
 * PaperInfo와 PDF Blob을 캐싱하기 위한 IndexedDB 래퍼
 */

import type {
  SOBKey,
  StoredPaperInfo,
  StoredPdfBlob,
  NprojJson,
} from '../types/paper-info';

const DB_NAME = 'PenStreamPaperCache';
const DB_VERSION = 1;

const STORE_PAPER_INFO = 'paperInfo';
const STORE_PDF_BLOBS = 'pdfBlobs';

class IndexedDbService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * IndexedDB 초기화
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // paperInfo store
        if (!db.objectStoreNames.contains(STORE_PAPER_INFO)) {
          const paperStore = db.createObjectStore(STORE_PAPER_INFO, {
            keyPath: 'sobKey',
          });
          paperStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }

        // pdfBlobs store
        if (!db.objectStoreNames.contains(STORE_PDF_BLOBS)) {
          const pdfStore = db.createObjectStore(STORE_PDF_BLOBS, {
            keyPath: 'sobKey',
          });
          pdfStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * DB 연결 확보
   */
  private async getDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
    return this.db;
  }

  // ============================================
  // PaperInfo 저장/조회
  // ============================================

  /**
   * PaperInfo 저장
   */
  async savePaperInfo(
    sobKey: SOBKey,
    paperGroupId: string,
    title: string,
    startPage: number,
    endPage: number,
    nprojJson: NprojJson
  ): Promise<void> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_PAPER_INFO, 'readwrite');
      const store = transaction.objectStore(STORE_PAPER_INFO);

      const data: StoredPaperInfo = {
        sobKey,
        paperGroupId,
        title,
        startPage,
        endPage,
        nprojJson,
        cachedAt: Date.now(),
      };

      const request = store.put(data);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * PaperInfo 조회
   */
  async getPaperInfo(sobKey: SOBKey): Promise<StoredPaperInfo | null> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_PAPER_INFO, 'readonly');
      const store = transaction.objectStore(STORE_PAPER_INFO);

      const request = store.get(sobKey);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
    });
  }

  /**
   * PaperInfo 삭제
   */
  async deletePaperInfo(sobKey: SOBKey): Promise<void> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_PAPER_INFO, 'readwrite');
      const store = transaction.objectStore(STORE_PAPER_INFO);

      const request = store.delete(sobKey);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // ============================================
  // PDF Blob 저장/조회
  // ============================================

  /**
   * PDF Blob 저장
   */
  async savePdfBlob(sobKey: SOBKey, pdfBlob: Blob): Promise<void> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_PDF_BLOBS, 'readwrite');
      const store = transaction.objectStore(STORE_PDF_BLOBS);

      const data: StoredPdfBlob = {
        sobKey,
        pdfBlob,
        cachedAt: Date.now(),
      };

      const request = store.put(data);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * PDF Blob 조회
   */
  async getPdfBlob(sobKey: SOBKey): Promise<Blob | null> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_PDF_BLOBS, 'readonly');
      const store = transaction.objectStore(STORE_PDF_BLOBS);

      const request = store.get(sobKey);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as StoredPdfBlob | undefined;
        resolve(result?.pdfBlob || null);
      };
    });
  }

  /**
   * PDF Blob 삭제
   */
  async deletePdfBlob(sobKey: SOBKey): Promise<void> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_PDF_BLOBS, 'readwrite');
      const store = transaction.objectStore(STORE_PDF_BLOBS);

      const request = store.delete(sobKey);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // ============================================
  // 복합 연산
  // ============================================

  /**
   * PaperInfo와 PDF Blob을 함께 저장
   */
  async saveAll(
    sobKey: SOBKey,
    paperGroupId: string,
    title: string,
    startPage: number,
    endPage: number,
    nprojJson: NprojJson,
    pdfBlob: Blob
  ): Promise<void> {
    await Promise.all([
      this.savePaperInfo(sobKey, paperGroupId, title, startPage, endPage, nprojJson),
      this.savePdfBlob(sobKey, pdfBlob),
    ]);
  }

  /**
   * PaperInfo와 PDF Blob을 함께 삭제
   */
  async deleteAll(sobKey: SOBKey): Promise<void> {
    await Promise.all([
      this.deletePaperInfo(sobKey),
      this.deletePdfBlob(sobKey),
    ]);
  }

  /**
   * 모든 캐시 키 조회
   */
  async getAllKeys(): Promise<SOBKey[]> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_PAPER_INFO, 'readonly');
      const store = transaction.objectStore(STORE_PAPER_INFO);

      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result as SOBKey[]);
      };
    });
  }

  /**
   * 전체 캐시 삭제
   */
  async clearAll(): Promise<void> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORE_PAPER_INFO, STORE_PDF_BLOBS],
        'readwrite'
      );

      let completed = 0;
      const checkDone = () => {
        completed++;
        if (completed === 2) resolve();
      };

      const paperStore = transaction.objectStore(STORE_PAPER_INFO);
      const pdfStore = transaction.objectStore(STORE_PDF_BLOBS);

      const paperClear = paperStore.clear();
      paperClear.onsuccess = checkDone;

      const pdfClear = pdfStore.clear();
      pdfClear.onsuccess = checkDone;

      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * 캐시 용량 조회 (대략적인 크기)
   */
  async getCacheStats(): Promise<{ count: number; estimatedSizeBytes: number }> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORE_PAPER_INFO, STORE_PDF_BLOBS],
        'readonly'
      );

      const paperStore = transaction.objectStore(STORE_PAPER_INFO);
      const pdfStore = transaction.objectStore(STORE_PDF_BLOBS);

      let count = 0;
      let estimatedSize = 0;

      const paperCountReq = paperStore.count();
      paperCountReq.onsuccess = () => {
        count = paperCountReq.result;
      };

      const pdfGetAllReq = pdfStore.getAll();
      pdfGetAllReq.onsuccess = () => {
        const blobs = pdfGetAllReq.result as StoredPdfBlob[];
        estimatedSize = blobs.reduce((sum, item) => sum + item.pdfBlob.size, 0);
        resolve({ count, estimatedSizeBytes: estimatedSize });
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * DB 연결 닫기
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

// 싱글톤 인스턴스
export const indexedDbService = new IndexedDbService();
