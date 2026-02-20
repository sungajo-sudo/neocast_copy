/**
 * Storage Provider Factory
 * 환경변수에 따라 적절한 스토리지 프로바이더를 생성
 */

import type { IStorageProvider } from './storage-provider.interface.js';
import { LocalStorageProvider } from './local-storage.provider.js';
import { GcsStorageProvider } from './gcs-storage.provider.js';
import type { GcsStorageConfig } from './gcs-storage.provider.js';
import { OciStorageProvider } from './oci-storage.provider.js';
import type { OciStorageConfig } from './oci-storage.provider.js';
import { logger } from '../../utils/logger.js';

export type { IStorageProvider, StorageFile, StorageOptions } from './storage-provider.interface.js';
export { LocalStorageProvider } from './local-storage.provider.js';
export { GcsStorageProvider } from './gcs-storage.provider.js';
export type { GcsStorageConfig } from './gcs-storage.provider.js';
export { OciStorageProvider } from './oci-storage.provider.js';
export type { OciStorageConfig } from './oci-storage.provider.js';

export type StorageType = 'local' | 'gcs' | 'oci';

let storageProvider: IStorageProvider | null = null;

/**
 * 스토리지 프로바이더 생성 팩토리
 */
export function createStorageProvider(type?: StorageType, config?: GcsStorageConfig | OciStorageConfig): IStorageProvider {
  const storageType = type || (process.env.STORAGE_TYPE as StorageType) || 'local';

  switch (storageType) {
    case 'gcs':
      logger.info('Creating GCS storage provider');
      return new GcsStorageProvider(config as GcsStorageConfig);

    case 'oci':
      logger.info('Creating OCI storage provider');
      return new OciStorageProvider(config as OciStorageConfig);

    case 'local':
    default:
      logger.info('Creating local storage provider');
      return new LocalStorageProvider();
  }
}

/**
 * 싱글톤 스토리지 프로바이더 가져오기
 */
export function getStorageProvider(): IStorageProvider {
  if (!storageProvider) {
    storageProvider = createStorageProvider();
  }
  return storageProvider;
}

/**
 * 스토리지 프로바이더 초기화
 */
export async function initializeStorage(): Promise<void> {
  const provider = getStorageProvider();
  await provider.initialize();
  logger.info('Storage provider initialized');
}

/**
 * 버킷 이름 상수
 */
export const STORAGE_BUCKETS = {
  FILES: 'files',    // 채팅 파일 첨부
  PAPERS: 'papers',  // NCode PDF/NPROJ
} as const;

export type StorageBucket = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS];
