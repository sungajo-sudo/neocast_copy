/**
 * Storage Provider Interface
 * 파일 스토리지 추상화 인터페이스 (로컬/GCS 공통)
 */

export interface StorageOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
}

export interface StorageFile {
  buffer: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
  size: number;
}

export interface IStorageProvider {
  /**
   * 파일 저장
   */
  save(bucket: string, key: string, buffer: Buffer, options?: StorageOptions): Promise<void>;

  /**
   * 파일 조회
   */
  get(bucket: string, key: string): Promise<StorageFile | null>;

  /**
   * 파일 존재 여부 확인
   */
  exists(bucket: string, key: string): Promise<boolean>;

  /**
   * 파일 삭제
   */
  delete(bucket: string, key: string): Promise<boolean>;

  /**
   * 특정 prefix로 시작하는 파일 목록 조회
   */
  list(bucket: string, prefix: string): Promise<string[]>;

  /**
   * 특정 prefix로 시작하는 모든 파일 삭제
   */
  deletePrefix(bucket: string, prefix: string): Promise<number>;

  /**
   * Signed URL 생성 (다운로드용)
   */
  getSignedUrl(bucket: string, key: string, expiresInSeconds?: number): Promise<string>;

  /**
   * 스토리지 초기화 (버킷 생성 등)
   */
  initialize(): Promise<void>;
}
