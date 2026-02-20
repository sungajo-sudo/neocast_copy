/**
 * 페이퍼 허브 페이퍼 등록 API
 *
 * PDF 파일을 업로드하면 다음 과정을 수행합니다:
 * 1. PDF 페이지 수를 분석하여 Unique NCode를 할당받음
 * 2. .nproj 파일을 생성 (NCode와 매핑 정보 포함)
 * 3. PaperHub에 Paper Group 등록 (PDF + NPROJ)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger.js';
import { getPdfPageCount, getPdfPageSize, generateNproj } from '../services/nproj-generator.service.js';
import { paperHubClientService } from '../services/paperhub-client.service.js';

// ============================================
// Types
// ============================================

// PDF 등록 요청 바디 (Multipart 필드)
interface RegisterPdfBody {
  title?: string; // 문서 제목
  section?: number; // 희망 Section 번호
  owner?: number; // 희망 Owner 번호
  tag?: string; // 태그 (예: livecast)
}

// PDF 등록 응답
interface RegisterPdfResponse {
  success: boolean;
  paperGroupId: string;
  ncode: {
    section: number;
    owner: number;
    bookCode: number;
    pageStart: number;
    pageEnd: number;
  };
  title: string;
  pageCount: number;
  progressStatus: string;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_SECTION = 5; // 기본 NCode 섹션
const DEFAULT_START_OWNER = 256; // 할당 시작 Owner 번호
const DEFAULT_MIN_OWNER = 0; // 최소 Owner 번호

// ============================================
// Routes
// ============================================

export async function paperHubPaperRegisterRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/paperhub/paper-register
   *
   * PDF 파일을 업로드하여 Paper Group 생성 및 등록
   *
   * Request: multipart/form-data
   * - pdfFile: PDF 파일 (필수)
   * - title: 문서 제목 (선택, 기본값: 파일명)
   * - section: NCode 섹션 (선택, 기본값: 5)
   * - owner: NCode owner (선택, 미설정 시 fallback 로직으로 자동 할당)
   * - tag: Paper Group 태그 (선택, 기본값: 'livecast')
   *
   * Response:
   * - paperGroupId: 생성된 Paper Group ID
   * - ncode: 할당된 NCode 정보
   * - title: 문서 제목
   * - pageCount: 페이지 수
   * - progressStatus: 처리 상태
   */
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Multipart 데이터 파싱
      const parts = await (request as unknown as { parts: () => AsyncIterable<MultipartPart> }).parts();

      let pdfBuffer: Buffer | null = null;
      let pdfFilename = 'document.pdf';
      const fields: RegisterPdfBody = {};

      for await (const part of parts) {
        if (part.type === 'file') {
          if (part.fieldname === 'pdfFile') {
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            pdfBuffer = Buffer.concat(chunks);
            pdfFilename = part.filename || 'document.pdf';
            logger.debug({ filename: pdfFilename, size: pdfBuffer.length }, 'PDF file received');
          }
        } else if (part.type === 'field') {
          const fieldName = part.fieldname as keyof RegisterPdfBody;
          if (fieldName === 'section' || fieldName === 'owner') {
            fields[fieldName] = parseInt(part.value as string, 10);
          } else {
            (fields as Record<string, unknown>)[fieldName] = part.value;
          }
        }
      }

      // PDF 파일 검증
      if (!pdfBuffer) {
        return reply.status(400).send({
          error: 'MISSING_PDF_FILE',
          message: 'pdfFile is required',
        });
      }

      // PDF 정보 추출 (페이지 수, 크기)
      const pageCount = getPdfPageCount(pdfBuffer);
      const pageSize = getPdfPageSize(pdfBuffer);
      const title = fields.title || pdfFilename.replace(/\.pdf$/i, '');

      logger.info({ filename: pdfFilename, pageCount, title }, 'Processing PDF for registration');

      // NCode 할당
      const section = fields.section ?? DEFAULT_SECTION;
      let ncodeResult;

      if (fields.owner !== undefined) {
        // Owner가 명시된 경우 해당 Owner 사용
        ncodeResult = {
          ncode: await paperHubClientService.allocateNCode(section, pageCount, true, fields.owner),
          actualOwner: fields.owner,
        };
      } else {
        // Owner 미지정 시 Fallback 로직 사용하여 자동 할당
        ncodeResult = await paperHubClientService.allocateNCodeWithFallback(
          section,
          pageCount,
          DEFAULT_START_OWNER,
          DEFAULT_MIN_OWNER,
          true
        );
      }

      const { ncode } = ncodeResult;

      logger.info(
        { section: ncode.section, owner: ncode.owner, bookCode: ncode.bookCode, pageCount },
        'NCode allocated for PDF'
      );

      // NPROJ 파일 내용 생성
      const nprojContent = generateNproj(
        {
          section: ncode.section,
          owner: ncode.owner,
          bookCode: ncode.bookCode,
          pageStart: ncode.pageStart,
          pageEnd: ncode.pageEnd,
        },
        title,
        pageSize
      );

      // Paper Group 생성 및 PDF, NPROJ 업로드 (PaperHub API 호출)
      const paperGroup = await paperHubClientService.createPaperGroupWithPdf(
        pdfBuffer,
        pdfFilename,
        nprojContent,
        {
          title,
          tag: fields.tag || 'livecast', // 기본 태그 설정
          accessScope: 'PUBLIC',
          unique: true,
        }
      );

      const response: RegisterPdfResponse = {
        success: true,
        paperGroupId: paperGroup.id,
        ncode: {
          section: ncode.section,
          owner: ncode.owner,
          bookCode: ncode.bookCode,
          pageStart: ncode.pageStart,
          pageEnd: ncode.pageEnd,
        },
        title,
        pageCount,
        progressStatus: paperGroup.progressStatus,
      };

      logger.info({ paperGroupId: paperGroup.id }, 'Paper Group registered successfully');

      return reply.send(response);
    } catch (error) {
      logger.error(error, 'Error registering paper');

      if (error instanceof Error) {
        return reply.status(500).send({
          error: 'REGISTRATION_ERROR',
          message: error.message,
        });
      }

      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to register paper',
      });
    }
  });

  /**
   * GET /api/paperhub/paper-register/:paperGroupId
   *
   * Paper Group 상태 및 정보 조회
   */
  app.get<{ Params: { paperGroupId: string } }>(
    '/:paperGroupId',
    async (request, reply) => {
      const { paperGroupId } = request.params;

      try {
        const paperGroup = await paperHubClientService.getPaperGroup(paperGroupId);
        return reply.send(paperGroup);
      } catch (error) {
        logger.error(error, 'Error getting paper group');

        if (error instanceof Error && error.message.includes('404')) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Paper Group not found',
          });
        }

        return reply.status(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to get paper group',
        });
      }
    }
  );
}

// ============================================
// Multipart Types (for Fastify multipart)
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
