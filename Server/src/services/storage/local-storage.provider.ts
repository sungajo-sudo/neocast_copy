/**
 * Local Storage Provider
 * 로컬 파일시스템 기반 스토리지 구현
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { IStorageProvider, StorageFile, StorageOptions } from './storage-provider.interface.js';
import { logger } from '../../utils/logger.js';

export class LocalStorageProvider implements IStorageProvider {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || process.env.LOCAL_STORAGE_PATH || './storage';
  }

  private getFilePath(bucket: string, key: string): string {
    return path.join(this.basePath, bucket, key);
  }

  private getMetaPath(bucket: string, key: string): string {
    return path.join(this.basePath, bucket, `${key}.meta.json`);
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
      logger.info({ basePath: this.basePath }, 'Local storage initialized');
    } catch (error) {
      logger.error({ error, basePath: this.basePath }, 'Failed to initialize local storage');
      throw error;
    }
  }

  async save(bucket: string, key: string, buffer: Buffer, options?: StorageOptions): Promise<void> {
    const filePath = this.getFilePath(bucket, key);
    const metaPath = this.getMetaPath(bucket, key);

    // 디렉토리 생성
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // 파일 저장
    await fs.writeFile(filePath, buffer);

    // 메타데이터 저장
    if (options) {
      const meta = {
        contentType: options.contentType,
        metadata: options.metadata,
        cacheControl: options.cacheControl,
        size: buffer.length,
      };
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
    }

    logger.debug({ bucket, key, size: buffer.length }, 'File saved to local storage');
  }

  async get(bucket: string, key: string): Promise<StorageFile | null> {
    const filePath = this.getFilePath(bucket, key);
    const metaPath = this.getMetaPath(bucket, key);

    try {
      const buffer = await fs.readFile(filePath);

      let contentType: string | undefined;
      let metadata: Record<string, string> | undefined;

      try {
        const metaJson = await fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(metaJson);
        contentType = meta.contentType;
        metadata = meta.metadata;
      } catch {
        // 메타데이터 없음 - 무시
      }

      return {
        buffer,
        contentType,
        metadata,
        size: buffer.length,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      logger.error({ error, bucket, key }, 'Failed to read file from local storage');
      throw error;
    }
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    const filePath = this.getFilePath(bucket, key);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(bucket: string, key: string): Promise<boolean> {
    const filePath = this.getFilePath(bucket, key);
    const metaPath = this.getMetaPath(bucket, key);

    try {
      await fs.unlink(filePath);

      // 메타데이터 파일도 삭제 (있으면)
      try {
        await fs.unlink(metaPath);
      } catch {
        // 메타데이터 파일 없음 - 무시
      }

      logger.debug({ bucket, key }, 'File deleted from local storage');
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      logger.error({ error, bucket, key }, 'Failed to delete file from local storage');
      throw error;
    }
  }

  async list(bucket: string, prefix: string): Promise<string[]> {
    const bucketPath = path.join(this.basePath, bucket);
    const prefixDir = path.dirname(prefix);
    const prefixBase = path.basename(prefix);
    const searchPath = prefixDir ? path.join(bucketPath, prefixDir) : bucketPath;

    const result: string[] = [];

    try {
      const files = await this.listRecursive(searchPath);

      for (const file of files) {
        const relativePath = path.relative(bucketPath, file);

        // .meta.json 파일 제외
        if (relativePath.endsWith('.meta.json')) {
          continue;
        }

        // prefix 필터링
        if (relativePath.startsWith(prefix) || (prefixDir && relativePath.startsWith(prefixDir) && path.basename(relativePath).startsWith(prefixBase))) {
          result.push(relativePath);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return result;
  }

  private async listRecursive(dir: string): Promise<string[]> {
    const result: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.listRecursive(fullPath);
          result.push(...subFiles);
        } else {
          result.push(fullPath);
        }
      }
    } catch {
      // 디렉토리 없음
    }

    return result;
  }

  async deletePrefix(bucket: string, prefix: string): Promise<number> {
    const keys = await this.list(bucket, prefix);
    let deletedCount = 0;

    for (const key of keys) {
      const deleted = await this.delete(bucket, key);
      if (deleted) {
        deletedCount++;
      }
    }

    logger.info({ bucket, prefix, deletedCount }, 'Files deleted by prefix from local storage');
    return deletedCount;
  }

  async getSignedUrl(bucket: string, key: string, _expiresInSeconds?: number): Promise<string> {
    // 로컬 스토리지는 서버를 통해 직접 제공하므로 상대 경로 반환
    // 실제 signed URL 대신 API 경로를 반환
    return `/api/storage/${bucket}/${key}`;
  }
}
