/**
 * File Upload Routes
 * 채팅 파일 첨부 및 일반 파일 업로드 API
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { fileStorageService } from '../services/file-storage.service.js';
import { verifyAccessToken } from '../services/auth.service.js';
import { AuthenticationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// ============================================
// Auth Helper
// ============================================

function getAuthUser(request: { headers: { authorization?: string } }) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError('Authorization required');
  }
  return verifyAccessToken(authHeader.slice(7));
}

// ============================================
// Types
// ============================================

interface MultipartFile {
  type: 'file';
  fieldname: string;
  filename: string;
  encoding: string;
  mimetype: string;
  file: AsyncIterable<Buffer>;
}

interface MultipartField {
  type: 'field';
  fieldname: string;
  value: string;
}

type MultipartPart = MultipartFile | MultipartField;

// ============================================
// Routes
// ============================================

export async function fileUploadRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/files/upload
   * 파일 업로드
   *
   * multipart/form-data:
   * - file: 업로드할 파일
   * - sessionId (optional): 세션 ID (채팅 파일인 경우)
   */
  app.post('/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getAuthUser(request);
      const userId = user.userId;

      // Multipart 파싱
      const parts = await (
        request as unknown as { parts: () => AsyncIterable<MultipartPart> }
      ).parts();

      let fileBuffer: Buffer | null = null;
      let filename: string = '';
      let mimeType: string = '';
      let sessionId: string | undefined;

      for await (const part of parts) {
        if (part.type === 'file') {
          if (part.fieldname === 'file') {
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            fileBuffer = Buffer.concat(chunks);
            filename = part.filename;
            mimeType = part.mimetype;
          }
        } else if (part.type === 'field') {
          if (part.fieldname === 'sessionId') {
            sessionId = part.value;
          }
        }
      }

      // 파일 필수
      if (!fileBuffer || !filename) {
        return reply.status(400).send({
          error: 'MISSING_FILE',
          message: 'No file provided',
        });
      }

      // 파일 저장
      const result = await fileStorageService.saveFile(
        fileBuffer,
        filename,
        mimeType,
        userId,
        sessionId
      );

      return reply.send({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error(error, 'Error uploading file');

      if (error instanceof Error) {
        // 유효성 검사 에러
        if (
          error.message.includes('size exceeds') ||
          error.message.includes('not allowed')
        ) {
          return reply.status(400).send({
            error: 'VALIDATION_ERROR',
            message: error.message,
          });
        }
      }

      return reply.status(500).send({
        error: 'UPLOAD_ERROR',
        message: error instanceof Error ? error.message : 'Failed to upload file',
      });
    }
  });

  /**
   * GET /api/files/:fileId
   * 파일 다운로드
   */
  app.get<{ Params: { fileId: string } }>(
    '/:fileId',
    async (request, reply) => {
      try {
        const { fileId } = request.params;

        const result = await fileStorageService.getFile(fileId);

        if (!result) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'File not found',
          });
        }

        const { buffer, metadata } = result;

        return reply
          .header('Content-Type', metadata.mimeType)
          .header(
            'Content-Disposition',
            `attachment; filename="${encodeURIComponent(metadata.originalFilename)}"`
          )
          .header('Content-Length', metadata.size)
          .send(buffer);
      } catch (error) {
        logger.error(error, 'Error downloading file');
        return reply.status(500).send({
          error: 'DOWNLOAD_ERROR',
          message: error instanceof Error ? error.message : 'Failed to download file',
        });
      }
    }
  );

  /**
   * GET /api/files/:fileId/info
   * 파일 메타데이터 조회
   */
  app.get<{ Params: { fileId: string } }>(
    '/:fileId/info',
    async (request, reply) => {
      try {
        const { fileId } = request.params;

        const metadata = await fileStorageService.getMetadata(fileId);

        if (!metadata) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'File not found',
          });
        }

        return reply.send({
          success: true,
          file: {
            id: metadata.id,
            filename: metadata.originalFilename,
            mimeType: metadata.mimeType,
            size: metadata.size,
            uploadedAt: metadata.uploadedAt,
            url: `/api/files/${metadata.id}`,
          },
        });
      } catch (error) {
        logger.error(error, 'Error getting file info');
        return reply.status(500).send({
          error: 'GET_INFO_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get file info',
        });
      }
    }
  );

  /**
   * DELETE /api/files/:fileId
   * 파일 삭제 (업로드한 사용자만 가능)
   */
  app.delete<{ Params: { fileId: string } }>(
    '/:fileId',
    async (request, reply) => {
      try {
        const user = getAuthUser(request);
        const { fileId } = request.params;

        const metadata = await fileStorageService.getMetadata(fileId);

        if (!metadata) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'File not found',
          });
        }

        // 권한 확인
        if (metadata.uploadedBy !== user.userId) {
          return reply.status(403).send({
            error: 'FORBIDDEN',
            message: 'You can only delete your own files',
          });
        }

        await fileStorageService.deleteFile(fileId);

        return reply.send({
          success: true,
          message: 'File deleted',
        });
      } catch (error) {
        logger.error(error, 'Error deleting file');
        return reply.status(500).send({
          error: 'DELETE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete file',
        });
      }
    }
  );
}
