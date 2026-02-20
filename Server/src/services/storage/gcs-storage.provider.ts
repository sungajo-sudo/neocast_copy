/**
 * Google Cloud Storage Provider
 * GCS 기반 스토리지 구현
 */

import { Storage, Bucket, GetSignedUrlConfig } from '@google-cloud/storage';
import { IStorageProvider, StorageFile, StorageOptions } from './storage-provider.interface.js';
import { logger } from '../../utils/logger.js';

export interface GcsStorageConfig {
  projectId?: string;
  bucketPrefix?: string;
  credentials?: string; // JSON 파일 경로 또는 JSON 문자열
  emulatorHost?: string; // fake-gcs-server용
}

export class GcsStorageProvider implements IStorageProvider {
  private storage: Storage;
  private bucketPrefix: string;
  private bucketCache: Map<string, Bucket> = new Map();

  constructor(config?: GcsStorageConfig) {
    const projectId = config?.projectId || process.env.GCS_PROJECT_ID;
    const emulatorHost = config?.emulatorHost || process.env.GCS_EMULATOR_HOST;
    const credentials = config?.credentials || process.env.GCS_CREDENTIALS;

    this.bucketPrefix = config?.bucketPrefix || process.env.GCS_BUCKET_PREFIX || 'neocast';

    // Storage 인스턴스 생성
    const storageOptions: ConstructorParameters<typeof Storage>[0] = {
      projectId,
    };

    // 에뮬레이터 사용 시
    if (emulatorHost) {
      storageOptions.apiEndpoint = emulatorHost;
      // 에뮬레이터에서는 인증 불필요
      logger.info({ emulatorHost, projectId }, 'Using GCS emulator');
    } else if (credentials) {
      // 서비스 계정 키 파일 또는 JSON 문자열
      if (credentials.startsWith('{')) {
        storageOptions.credentials = JSON.parse(credentials);
      } else {
        storageOptions.keyFilename = credentials;
      }
    }
    // 그 외의 경우 ADC (Application Default Credentials) 사용

    this.storage = new Storage(storageOptions);
  }

  private getBucketName(bucket: string): string {
    return `${this.bucketPrefix}-${bucket}`;
  }

  private async getBucket(bucket: string): Promise<Bucket> {
    const bucketName = this.getBucketName(bucket);

    if (this.bucketCache.has(bucketName)) {
      return this.bucketCache.get(bucketName)!;
    }

    const bucketInstance = this.storage.bucket(bucketName);
    this.bucketCache.set(bucketName, bucketInstance);

    return bucketInstance;
  }

  async initialize(): Promise<void> {
    // 기본 버킷들 생성 (에뮬레이터 또는 권한이 있는 경우)
    const defaultBuckets = ['files', 'papers'];

    for (const bucket of defaultBuckets) {
      const bucketName = this.getBucketName(bucket);

      try {
        const bucketInstance = this.storage.bucket(bucketName);
        const [exists] = await bucketInstance.exists();

        if (!exists) {
          await this.storage.createBucket(bucketName);
          logger.info({ bucketName }, 'GCS bucket created');
        }
      } catch (error) {
        // 버킷 생성 실패 - 이미 존재하거나 권한 없음
        logger.warn({ error, bucketName }, 'Failed to create GCS bucket (may already exist)');
      }
    }

    logger.info({ bucketPrefix: this.bucketPrefix }, 'GCS storage initialized');
  }

  async save(bucket: string, key: string, buffer: Buffer, options?: StorageOptions): Promise<void> {
    const bucketInstance = await this.getBucket(bucket);
    const file = bucketInstance.file(key);

    const writeOptions: Parameters<typeof file.save>[1] = {
      resumable: false, // 작은 파일에 적합
      metadata: {
        contentType: options?.contentType,
        cacheControl: options?.cacheControl,
        metadata: options?.metadata,
      },
    };

    await file.save(buffer, writeOptions);

    logger.debug({ bucket, key, size: buffer.length }, 'File saved to GCS');
  }

  async get(bucket: string, key: string): Promise<StorageFile | null> {
    const bucketInstance = await this.getBucket(bucket);
    const file = bucketInstance.file(key);

    try {
      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }

      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();

      return {
        buffer,
        contentType: metadata.contentType,
        metadata: metadata.metadata as Record<string, string> | undefined,
        size: buffer.length,
      };
    } catch (error) {
      logger.error({ error, bucket, key }, 'Failed to get file from GCS');
      return null;
    }
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    const bucketInstance = await this.getBucket(bucket);
    const file = bucketInstance.file(key);

    try {
      const [exists] = await file.exists();
      return exists;
    } catch {
      return false;
    }
  }

  async delete(bucket: string, key: string): Promise<boolean> {
    const bucketInstance = await this.getBucket(bucket);
    const file = bucketInstance.file(key);

    try {
      const [exists] = await file.exists();
      if (!exists) {
        return false;
      }

      await file.delete();
      logger.debug({ bucket, key }, 'File deleted from GCS');
      return true;
    } catch (error) {
      logger.error({ error, bucket, key }, 'Failed to delete file from GCS');
      return false;
    }
  }

  async list(bucket: string, prefix: string): Promise<string[]> {
    const bucketInstance = await this.getBucket(bucket);

    try {
      const [files] = await bucketInstance.getFiles({ prefix });
      return files.map(file => file.name);
    } catch (error) {
      logger.error({ error, bucket, prefix }, 'Failed to list files from GCS');
      return [];
    }
  }

  async deletePrefix(bucket: string, prefix: string): Promise<number> {
    const bucketInstance = await this.getBucket(bucket);

    try {
      const [files] = await bucketInstance.getFiles({ prefix });

      if (files.length === 0) {
        return 0;
      }

      await Promise.all(files.map(file => file.delete()));

      logger.info({ bucket, prefix, deletedCount: files.length }, 'Files deleted by prefix from GCS');
      return files.length;
    } catch (error) {
      logger.error({ error, bucket, prefix }, 'Failed to delete files by prefix from GCS');
      return 0;
    }
  }

  async getSignedUrl(bucket: string, key: string, expiresInSeconds = 3600): Promise<string> {
    const bucketInstance = await this.getBucket(bucket);
    const file = bucketInstance.file(key);

    const options: GetSignedUrlConfig = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
    };

    try {
      const [url] = await file.getSignedUrl(options);
      return url;
    } catch (error) {
      logger.error({ error, bucket, key }, 'Failed to generate signed URL');
      throw error;
    }
  }
}
