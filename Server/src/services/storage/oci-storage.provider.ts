/**
 * OCI Object Storage Provider
 * Oracle Cloud Infrastructure Object Storage 기반 스토리지 구현
 */

import * as common from 'oci-common';
import * as objectstorage from 'oci-objectstorage';
import { Readable } from 'stream';
import { IStorageProvider, StorageFile, StorageOptions } from './storage-provider.interface.js';
import { logger } from '../../utils/logger.js';

export interface OciStorageConfig {
  bucketPrefix?: string;       // OCI_BUCKET_PREFIX (default: 'neocast')
  compartmentId?: string;      // OCI_COMPARTMENT_ID
  namespaceName?: string;      // OCI_NAMESPACE (auto-discover 가능)
  region?: string;             // OCI_REGION
  // API Key 인증 (Docker 환경 권장)
  tenancyId?: string;          // OCI_TENANCY_ID
  userId?: string;             // OCI_USER_ID
  fingerprint?: string;        // OCI_FINGERPRINT
  privateKey?: string;         // OCI_PRIVATE_KEY (PEM 문자열)
  passphrase?: string;         // OCI_PASSPHRASE
}

export class OciStorageProvider implements IStorageProvider {
  private client: objectstorage.ObjectStorageClient;
  private bucketPrefix: string;
  private compartmentId: string;
  private namespaceName: string | null = null;
  private region: string;

  constructor(config?: OciStorageConfig) {
    const tenancyId = config?.tenancyId || process.env.OCI_TENANCY_ID;
    const userId = config?.userId || process.env.OCI_USER_ID;
    const fingerprint = config?.fingerprint || process.env.OCI_FINGERPRINT;
    const privateKeyRaw = config?.privateKey || process.env.OCI_PRIVATE_KEY;
    const passphrase = config?.passphrase || process.env.OCI_PASSPHRASE || null;

    this.bucketPrefix = config?.bucketPrefix || process.env.OCI_BUCKET_PREFIX || 'neocast';
    this.compartmentId = config?.compartmentId || process.env.OCI_COMPARTMENT_ID || '';
    this.region = config?.region || process.env.OCI_REGION || 'ap-seoul-1';

    if (config?.namespaceName || process.env.OCI_NAMESPACE) {
      this.namespaceName = config?.namespaceName || process.env.OCI_NAMESPACE || null;
    }

    if (!tenancyId || !userId || !fingerprint || !privateKeyRaw) {
      throw new Error(
        'OCI credentials required: OCI_TENANCY_ID, OCI_USER_ID, OCI_FINGERPRINT, OCI_PRIVATE_KEY'
      );
    }

    // Private key: \n 이스케이프 → 실제 줄바꿈 변환
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    const provider = new common.SimpleAuthenticationDetailsProvider(
      tenancyId,
      userId,
      fingerprint,
      privateKey,
      passphrase
    );

    this.client = new objectstorage.ObjectStorageClient({
      authenticationDetailsProvider: provider,
    });
    this.client.region = common.Region.fromRegionId(this.region);
  }

  private getBucketName(bucket: string): string {
    return `${this.bucketPrefix}-${bucket}`;
  }

  private async getNamespace(): Promise<string> {
    if (this.namespaceName) {
      return this.namespaceName;
    }

    const response = await this.client.getNamespace({});
    this.namespaceName = response.value;
    logger.info({ namespace: this.namespaceName }, 'OCI namespace discovered');
    return this.namespaceName;
  }

  async initialize(): Promise<void> {
    const namespaceName = await this.getNamespace();
    const defaultBuckets = ['files', 'papers'];

    for (const bucket of defaultBuckets) {
      const bucketName = this.getBucketName(bucket);

      try {
        await this.client.headBucket({
          namespaceName,
          bucketName,
        });
        logger.info({ bucketName }, 'OCI bucket exists');
      } catch (error: any) {
        if (error.statusCode === 404) {
          try {
            await this.client.createBucket({
              namespaceName,
              createBucketDetails: {
                name: bucketName,
                compartmentId: this.compartmentId,
                storageTier: objectstorage.models.CreateBucketDetails.StorageTier.Standard,
                publicAccessType: objectstorage.models.CreateBucketDetails.PublicAccessType.NoPublicAccess,
              },
            });
            logger.info({ bucketName }, 'OCI bucket created');
          } catch (createError) {
            logger.warn({ error: createError, bucketName }, 'Failed to create OCI bucket');
          }
        } else {
          logger.warn({ error, bucketName }, 'Failed to check OCI bucket');
        }
      }
    }

    logger.info({ bucketPrefix: this.bucketPrefix, namespaceName }, 'OCI storage initialized');
  }

  async save(bucket: string, key: string, buffer: Buffer, options?: StorageOptions): Promise<void> {
    const namespaceName = await this.getNamespace();
    const bucketName = this.getBucketName(bucket);

    // OCI opc-meta-* 헤더는 ASCII(ByteString)만 허용 → non-ASCII 값을 URI-encode
    let safeMeta: Record<string, string> | undefined;
    if (options?.metadata) {
      safeMeta = {};
      for (const [k, v] of Object.entries(options.metadata)) {
        safeMeta[k] = /^[\x00-\xff]*$/.test(v) ? v : encodeURIComponent(v);
      }
    }

    await this.client.putObject({
      namespaceName,
      bucketName,
      objectName: key,
      contentLength: buffer.length,
      putObjectBody: buffer,
      contentType: options?.contentType,
      opcMeta: safeMeta,
    });

    logger.debug({ bucket, key, size: buffer.length }, 'File saved to OCI');
  }

  async get(bucket: string, key: string): Promise<StorageFile | null> {
    const namespaceName = await this.getNamespace();
    const bucketName = this.getBucketName(bucket);

    try {
      const response = await this.client.getObject({
        namespaceName,
        bucketName,
        objectName: key,
      });

      const stream = response.value as Readable;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      return {
        buffer,
        contentType: response.contentType,
        metadata: response.opcMeta as Record<string, string> | undefined,
        size: buffer.length,
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      logger.error({ error, bucket, key }, 'Failed to get file from OCI');
      return null;
    }
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    const namespaceName = await this.getNamespace();
    const bucketName = this.getBucketName(bucket);

    try {
      await this.client.headObject({
        namespaceName,
        bucketName,
        objectName: key,
      });
      return true;
    } catch {
      return false;
    }
  }

  async delete(bucket: string, key: string): Promise<boolean> {
    const namespaceName = await this.getNamespace();
    const bucketName = this.getBucketName(bucket);

    try {
      await this.client.deleteObject({
        namespaceName,
        bucketName,
        objectName: key,
      });
      logger.debug({ bucket, key }, 'File deleted from OCI');
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return false;
      }
      logger.error({ error, bucket, key }, 'Failed to delete file from OCI');
      return false;
    }
  }

  async list(bucket: string, prefix: string): Promise<string[]> {
    const namespaceName = await this.getNamespace();
    const bucketName = this.getBucketName(bucket);
    const allObjects: string[] = [];
    let nextStartWith: string | undefined;

    try {
      do {
        const response = await this.client.listObjects({
          namespaceName,
          bucketName,
          prefix,
          start: nextStartWith,
        });

        const objects = response.listObjects.objects;
        for (const obj of objects) {
          allObjects.push(obj.name);
        }

        nextStartWith = response.listObjects.nextStartWith;
      } while (nextStartWith);

      return allObjects;
    } catch (error) {
      logger.error({ error, bucket, prefix }, 'Failed to list files from OCI');
      return [];
    }
  }

  async deletePrefix(bucket: string, prefix: string): Promise<number> {
    try {
      const keys = await this.list(bucket, prefix);
      if (keys.length === 0) {
        return 0;
      }

      await Promise.all(keys.map(key => this.delete(bucket, key)));

      logger.info({ bucket, prefix, deletedCount: keys.length }, 'Files deleted by prefix from OCI');
      return keys.length;
    } catch (error) {
      logger.error({ error, bucket, prefix }, 'Failed to delete files by prefix from OCI');
      return 0;
    }
  }

  async getSignedUrl(bucket: string, key: string, expiresInSeconds = 3600): Promise<string> {
    const namespaceName = await this.getNamespace();
    const bucketName = this.getBucketName(bucket);

    try {
      const expireTime = new Date(Date.now() + expiresInSeconds * 1000);

      const response = await this.client.createPreauthenticatedRequest({
        namespaceName,
        bucketName,
        createPreauthenticatedRequestDetails: {
          name: `par-${key}-${Date.now()}`,
          objectName: key,
          accessType: objectstorage.models.CreatePreauthenticatedRequestDetails.AccessType.ObjectRead,
          timeExpires: expireTime,
        },
      });

      const accessUri = response.preauthenticatedRequest.accessUri;
      return `https://objectstorage.${this.region}.oraclecloud.com${accessUri}`;
    } catch (error) {
      logger.error({ error, bucket, key }, 'Failed to generate signed URL from OCI');
      throw error;
    }
  }
}
