/**
 * File Storage Service
 * 채팅 파일 첨부 및 일반 파일 업로드를 위한 파일 저장 서비스
 * IStorageProvider를 사용하여 로컬/GCS 모두 지원
 */

import * as path from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';
import { getStorageProvider, IStorageProvider, STORAGE_BUCKETS } from './storage/index.js';

// ============================================
// Types
// ============================================

export interface FileMetadata {
  id: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
  sessionId?: string;
}

export interface UploadResult {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

// ============================================
// FileStorageService Class
// ============================================

class FileStorageService {
  private storage: IStorageProvider;
  private metadataCache: Map<string, FileMetadata> = new Map();

  constructor() {
    this.storage = getStorageProvider();
  }

  /**
   * 파일 유효성 검사
   * 모든 파일 타입 허용 (제한 없음)
   */
  validateFile(_filename: string, _mimeType: string, _size: number): void {
    // 모든 파일 타입 허용 - 제한 없음
  }

  /**
   * 파일 저장
   */
  async saveFile(
    buffer: Buffer,
    originalFilename: string,
    mimeType: string,
    uploadedBy: string,
    sessionId?: string
  ): Promise<UploadResult> {
    // 유효성 검사
    this.validateFile(originalFilename, mimeType, buffer.length);

    // 고유 파일 ID 생성
    const fileId = randomUUID();
    const ext = path.extname(originalFilename).toLowerCase();
    const storedFilename = `${fileId}${ext}`;

    // 메타데이터 생성
    const metadata: FileMetadata = {
      id: fileId,
      originalFilename,
      storedFilename,
      mimeType,
      size: buffer.length,
      uploadedBy,
      uploadedAt: new Date(),
      sessionId,
    };

    // 파일 저장
    await this.storage.save(STORAGE_BUCKETS.FILES, storedFilename, buffer, {
      contentType: mimeType,
      metadata: {
        originalFilename,
        uploadedBy,
        sessionId: sessionId || '',
      },
    });

    // 메타데이터 저장
    const metadataJson = JSON.stringify(metadata, null, 2);
    await this.storage.save(STORAGE_BUCKETS.FILES, `${fileId}.meta.json`, Buffer.from(metadataJson), {
      contentType: 'application/json',
    });

    // 캐시에 저장
    this.metadataCache.set(fileId, metadata);

    logger.info(
      { fileId, filename: originalFilename, size: buffer.length, uploadedBy },
      'File saved'
    );

    return {
      fileId,
      filename: originalFilename,
      mimeType,
      size: buffer.length,
      url: `/api/files/${fileId}`,
    };
  }

  /**
   * 파일 조회
   */
  async getFile(fileId: string): Promise<{ buffer: Buffer; metadata: FileMetadata } | null> {
    // 메타데이터 조회
    const metadata = await this.getMetadata(fileId);
    if (!metadata) {
      return null;
    }

    // 파일 읽기
    const storageFile = await this.storage.get(STORAGE_BUCKETS.FILES, metadata.storedFilename);
    if (!storageFile) {
      logger.error({ fileId }, 'File not found in storage');
      return null;
    }

    return { buffer: storageFile.buffer, metadata };
  }

  /**
   * 파일 메타데이터만 조회
   */
  async getMetadata(fileId: string): Promise<FileMetadata | null> {
    // 캐시에서 조회
    let metadata = this.metadataCache.get(fileId);

    if (!metadata) {
      // 스토리지에서 메타데이터 파일 로드
      const metaFile = await this.storage.get(STORAGE_BUCKETS.FILES, `${fileId}.meta.json`);
      if (!metaFile) {
        return null;
      }

      try {
        metadata = JSON.parse(metaFile.buffer.toString('utf-8')) as FileMetadata;
        this.metadataCache.set(fileId, metadata);
      } catch {
        return null;
      }
    }

    return metadata;
  }

  /**
   * 파일 삭제
   */
  async deleteFile(fileId: string): Promise<boolean> {
    const metadata = await this.getMetadata(fileId);
    if (!metadata) {
      return false;
    }

    // 파일 삭제
    await this.storage.delete(STORAGE_BUCKETS.FILES, metadata.storedFilename);

    // 메타데이터 파일 삭제
    await this.storage.delete(STORAGE_BUCKETS.FILES, `${fileId}.meta.json`);

    // 캐시에서 제거
    this.metadataCache.delete(fileId);

    logger.info({ fileId }, 'File deleted');
    return true;
  }

  /**
   * 세션의 모든 파일 삭제
   */
  async deleteSessionFiles(sessionId: string): Promise<number> {
    let deletedCount = 0;

    // 메타데이터 파일 목록 조회
    const metaFiles = await this.storage.list(STORAGE_BUCKETS.FILES, '');
    const metaJsonFiles = metaFiles.filter((f) => f.endsWith('.meta.json'));

    for (const metaFile of metaJsonFiles) {
      try {
        const storageFile = await this.storage.get(STORAGE_BUCKETS.FILES, metaFile);
        if (!storageFile) continue;

        const metadata = JSON.parse(storageFile.buffer.toString('utf-8')) as FileMetadata;

        if (metadata.sessionId === sessionId) {
          await this.deleteFile(metadata.id);
          deletedCount++;
        }
      } catch {
        // 개별 파일 처리 실패는 무시
      }
    }

    logger.info({ sessionId, deletedCount }, 'Session files deleted');
    return deletedCount;
  }

  /**
   * 저장소 통계
   */
  async getStats(): Promise<{ fileCount: number; totalSize: number }> {
    let fileCount = 0;
    let totalSize = 0;

    try {
      const files = await this.storage.list(STORAGE_BUCKETS.FILES, '');
      const metaFiles = files.filter((f) => f.endsWith('.meta.json'));

      for (const metaFile of metaFiles) {
        try {
          const storageFile = await this.storage.get(STORAGE_BUCKETS.FILES, metaFile);
          if (!storageFile) continue;

          const metadata = JSON.parse(storageFile.buffer.toString('utf-8')) as FileMetadata;
          fileCount++;
          totalSize += metadata.size;
        } catch {
          // 개별 파일 처리 실패는 무시
        }
      }
    } catch {
      // 디렉토리 없음 등
    }

    return { fileCount, totalSize };
  }
}

// 싱글톤 인스턴스
export const fileStorageService = new FileStorageService();
