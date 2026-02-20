/**
 * NcPaperHub API 라우트
 * 이용자별 SOBP 할당 및 페이퍼 관리 API
 *
 * 흐름:
 * 1. 클라이언트: /allocate 호출 → SOBP 할당 받음
 * 2. 클라이언트: PDF 로드, NPROJ 생성
 * 3. 클라이언트: /attach 호출 → PDF/NPROJ 업로드
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ncPaperHubService } from '../services/nc-paperhub.service.js';
import { verifyAccessToken } from '../services/auth.service.js';
import { AuthenticationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * 요청 헤더에서 인증 토큰을 추출하고 검증하여 사용자 정보를 반환합니다.
 */
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

interface AllocateBody {
  pageCount: number;
  section?: number;
  owner?: number;
}

interface AttachResponse {
  success: boolean;
  paperGroupId: string;
  sobKey: string;
  ncode: {
    section: number;
    owner: number;
    book: number;
    pageStart: number;
    pageEnd: number;
  };
  title: string;
  pageCount: number;
}

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

export async function ncPaperHubRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/nc-paperhub/allocate
   * SOBP 할당 (PDF 없이 코드만 할당)
   *
   * 클라이언트는 이 API로 SOBP 영역을 할당받고,
   * 클라이언트에서 NPROJ를 생성한 후 /attach로 업로드합니다.
   */
  app.post<{ Body: AllocateBody }>(
    '/allocate',
    async (request: FastifyRequest<{ Body: AllocateBody }>, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        const userId = user.userId;
        const { pageCount, section, owner } = request.body;

        if (!pageCount || pageCount <= 0) {
          return reply.status(400).send({
            error: 'INVALID_PAGE_COUNT',
            message: 'pageCount must be a positive number',
          });
        }

        const result = await ncPaperHubService.allocateNcode({
          userId,
          pageCount,
          section,
          owner,
        });

        return reply.send({
          success: true,
          ...result,
        });
      } catch (error) {
        logger.error(error, 'Error allocating NCode');
        return reply.status(500).send({
          error: 'ALLOCATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to allocate NCode',
        });
      }
    }
  );

  /**
   * POST /api/nc-paperhub/attach
   * Paper 첨부 (클라이언트에서 생성한 PDF/NPROJ 업로드)
   *
   * multipart/form-data:
   * - pdfFile: PDF 파일
   * - nprojXml: NPROJ XML 문자열
   * - paperGroupId: 할당받은 paperGroupId
   * - sobKey: S.O.B 키
   * - title: 문서 제목
   * - section, owner, book, pageStart, pageEnd, pageCount: SOBP 정보
   */
  app.post(
    '/attach',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        const userId = user.userId;

        // Multipart 파싱
        const parts = await (request as unknown as { parts: () => AsyncIterable<MultipartPart> }).parts();

        let pdfBuffer: Buffer | null = null;
        let nprojXml: string | null = null;
        let paperGroupId: string | null = null;
        let sobKey: string | null = null;
        let title: string = 'Untitled';
        let section: number = 0;
        let owner: number = 0;
        let book: number = 0;
        let pageStart: number = 0;
        let pageEnd: number = 0;
        let pageCount: number = 0;

        for await (const part of parts) {
          if (part.type === 'file') {
            if (part.fieldname === 'pdfFile') {
              const chunks: Buffer[] = [];
              for await (const chunk of part.file) {
                chunks.push(chunk);
              }
              pdfBuffer = Buffer.concat(chunks);
            }
          } else if (part.type === 'field') {
            switch (part.fieldname) {
              case 'nprojXml':
                nprojXml = part.value;
                break;
              case 'paperGroupId':
                paperGroupId = part.value;
                break;
              case 'sobKey':
                sobKey = part.value;
                break;
              case 'title':
                title = part.value;
                break;
              case 'section':
                section = parseInt(part.value, 10);
                break;
              case 'owner':
                owner = parseInt(part.value, 10);
                break;
              case 'book':
                book = parseInt(part.value, 10);
                break;
              case 'pageStart':
                pageStart = parseInt(part.value, 10);
                break;
              case 'pageEnd':
                pageEnd = parseInt(part.value, 10);
                break;
              case 'pageCount':
                pageCount = parseInt(part.value, 10);
                break;
            }
          }
        }

        // 필수 필드 검증
        if (!pdfBuffer) {
          return reply.status(400).send({
            error: 'MISSING_PDF_FILE',
            message: 'pdfFile is required',
          });
        }

        if (!nprojXml) {
          return reply.status(400).send({
            error: 'MISSING_NPROJ',
            message: 'nprojXml is required',
          });
        }

        if (!paperGroupId || !sobKey) {
          return reply.status(400).send({
            error: 'MISSING_SOBP_INFO',
            message: 'paperGroupId and sobKey are required',
          });
        }

        const result = await ncPaperHubService.attachPaper({
          userId,
          paperGroupId,
          sobKey,
          title,
          section,
          owner,
          book,
          pageStart,
          pageEnd,
          pageCount,
          nprojXml,
          pdfBuffer,
        });

        const response: AttachResponse = {
          success: true,
          paperGroupId: result.paperGroupId,
          sobKey: result.sobKey,
          ncode: {
            section: result.section,
            owner: result.owner,
            book: result.book,
            pageStart: result.pageStart,
            pageEnd: result.pageEnd,
          },
          title: result.title,
          pageCount: result.pageCount,
        };

        return reply.send(response);
      } catch (error) {
        logger.error(error, 'Error attaching paper');
        return reply.status(500).send({
          error: 'ATTACH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to attach paper',
        });
      }
    }
  );

  /**
   * GET /api/nc-paperhub/papers
   * 사용자의 모든 페이퍼 목록 조회
   */
  app.get(
    '/papers',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        const userId = user.userId;
        const papers = await ncPaperHubService.getUserPapers(userId);

        return reply.send({
          success: true,
          papers: papers.map((p) => ({
            paperGroupId: p.paperGroupId,
            sobKey: p.sobKey,
            title: p.title,
            section: p.section,
            owner: p.owner,
            book: p.book,
            pageStart: p.pageStart,
            pageEnd: p.pageEnd,
            pageCount: p.pageCount,
            createdAt: p.createdAt,
          })),
        });
      } catch (error) {
        logger.error(error, 'Error getting papers');
        return reply.status(500).send({
          error: 'GET_PAPERS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get papers',
        });
      }
    }
  );

  /**
   * GET /api/nc-paperhub/paper/:paperGroupId
   * 특정 페이퍼 정보 조회
   */
  app.get<{ Params: { paperGroupId: string } }>(
    '/paper/:paperGroupId',
    async (request, reply) => {
      try {
        const { paperGroupId } = request.params;
        const paper = await ncPaperHubService.getPaperByGroupId(paperGroupId);

        if (!paper) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Paper not found',
          });
        }

        return reply.send({
          success: true,
          paper: {
            paperGroupId: paper.paperGroupId,
            userId: paper.userId,
            sobKey: paper.sobKey,
            title: paper.title,
            section: paper.section,
            owner: paper.owner,
            book: paper.book,
            pageStart: paper.pageStart,
            pageEnd: paper.pageEnd,
            pageCount: paper.pageCount,
            nprojXml: paper.nprojXml,
            createdAt: paper.createdAt,
          },
        });
      } catch (error) {
        logger.error(error, 'Error getting paper');
        return reply.status(500).send({
          error: 'GET_PAPER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get paper',
        });
      }
    }
  );

  /**
   * GET /api/nc-paperhub/paper/:paperGroupId/pdf
   * PDF 파일 다운로드
   */
  app.get<{ Params: { paperGroupId: string } }>(
    '/paper/:paperGroupId/pdf',
    async (request, reply) => {
      try {
        const { paperGroupId } = request.params;
        const paper = await ncPaperHubService.getPaperByGroupId(paperGroupId);

        if (!paper) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Paper not found',
          });
        }

        const pdfBuffer = await ncPaperHubService.getPdfBuffer(paperGroupId);

        if (!pdfBuffer) {
          return reply.status(404).send({
            error: 'PDF_NOT_FOUND',
            message: 'PDF file not found',
          });
        }

        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="${paper.title}.pdf"`)
          .send(pdfBuffer);
      } catch (error) {
        logger.error(error, 'Error getting PDF');
        return reply.status(500).send({
          error: 'GET_PDF_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get PDF',
        });
      }
    }
  );

  /**
   * GET /api/nc-paperhub/paper/:paperGroupId/nproj
   * NPROJ 파일 다운로드
   */
  app.get<{ Params: { paperGroupId: string } }>(
    '/paper/:paperGroupId/nproj',
    async (request, reply) => {
      try {
        const { paperGroupId } = request.params;
        const paper = await ncPaperHubService.getPaperByGroupId(paperGroupId);

        if (!paper) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Paper not found',
          });
        }

        return reply
          .header('Content-Type', 'application/xml')
          .header('Content-Disposition', `attachment; filename="${paper.title}.nproj"`)
          .send(paper.nprojXml);
      } catch (error) {
        logger.error(error, 'Error getting NPROJ');
        return reply.status(500).send({
          error: 'GET_NPROJ_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get NPROJ',
        });
      }
    }
  );

  /**
   * GET /api/nc-paperhub/paper/:paperGroupId/compound
   * NP2 파일 다운로드 (PDF + NPROJ + 메타데이터)
   * 파일명 형식: {title}-{section}_{owner}_{book}_{pageStart}-{pageEnd}.np2
   */
  app.get<{ Params: { paperGroupId: string } }>(
    '/paper/:paperGroupId/compound',
    async (request, reply) => {
      try {
        const { paperGroupId } = request.params;
        const paper = await ncPaperHubService.getPaperByGroupId(paperGroupId);

        if (!paper) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Paper not found',
          });
        }

        const pdfBuffer = await ncPaperHubService.getPdfBuffer(paperGroupId);

        if (!pdfBuffer) {
          return reply.status(404).send({
            error: 'PDF_NOT_FOUND',
            message: 'PDF file not found',
          });
        }

        // NP2 Compound 생성
        const compound = {
          version: '1.0',
          hostId: paper.userId,
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
          pdfBase64: pdfBuffer.toString('base64'),
          createdAt: paper.createdAt.toISOString(),
        };

        // NP2 파일명 생성: {title}-{section}_{owner}_{book}_{pageStart}-{pageEnd}.np2
        const safeName = paper.title.replace(/[^a-zA-Z0-9가-힣\s_-]/g, '').trim();
        const np2Filename = `${safeName}-${paper.section}_${paper.owner}_${paper.book}_${paper.pageStart}-${paper.pageEnd}.np2`;

        return reply
          .header('Content-Type', 'application/json')
          .header('Content-Disposition', `attachment; filename="${np2Filename}"`)
          .send(compound);
      } catch (error) {
        logger.error(error, 'Error getting compound');
        return reply.status(500).send({
          error: 'GET_COMPOUND_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get compound',
        });
      }
    }
  );

  /**
   * DELETE /api/nc-paperhub/paper/:paperGroupId
   * 페이퍼 삭제
   */
  app.delete<{ Params: { paperGroupId: string } }>(
    '/paper/:paperGroupId',
    async (request, reply) => {
      try {
        const user = getAuthUser(request);
        const userId = user.userId;
        const { paperGroupId } = request.params;

        // 권한 확인
        const paper = await ncPaperHubService.getPaperByGroupId(paperGroupId);
        if (!paper) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Paper not found',
          });
        }

        if (paper.userId !== userId) {
          return reply.status(403).send({
            error: 'FORBIDDEN',
            message: 'You do not have permission to delete this paper',
          });
        }

        await ncPaperHubService.deletePaper(paperGroupId);

        return reply.send({
          success: true,
          message: 'Paper deleted',
        });
      } catch (error) {
        logger.error(error, 'Error deleting paper');
        return reply.status(500).send({
          error: 'DELETE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete paper',
        });
      }
    }
  );

  /**
   * POST /api/nc-paperhub/lookup
   * SOBP로 페이퍼 조회 (로컬 + NDP fallback)
   */
  app.post<{
    Body: { section: number; owner: number; book: number };
  }>(
    '/lookup',
    async (request, reply) => {
      try {
        const user = getAuthUser(request);
        const userId = user.userId;
        const { section, owner, book } = request.body;

        const result = await ncPaperHubService.getPaperWithFallback(userId, section, owner, book);

        if (result.paper) {
          return reply.send({
            success: true,
            source: result.source,
            paper: {
              paperGroupId: result.paper.paperGroupId,
              sobKey: result.paper.sobKey,
              title: result.paper.title,
              pageCount: result.paper.pageCount,
              createdAt: result.paper.createdAt,
            },
          });
        }

        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Paper not found',
          source: result.source,
        });
      } catch (error) {
        logger.error(error, 'Error looking up paper');
        return reply.status(500).send({
          error: 'LOOKUP_ERROR',
          message: error instanceof Error ? error.message : 'Failed to lookup paper',
        });
      }
    }
  );
}
