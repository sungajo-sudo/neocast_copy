import type { FastifyInstance } from 'fastify';
import { getNdpAccessToken } from '../services/ndp-token.service.js';
import { ndpRouterService } from '../services/ndp-router.service.js';
import { ncPaperHubService } from '../services/nc-paperhub.service.js';
import { logger } from '../utils/logger.js';

// 로컬 nc-paperhub에서 관리하는 섹션 범위 (0-15)
const LOCAL_SECTION_MIN = 0;
const LOCAL_SECTION_MAX = 15;

// PaperHub API 응답 타입 정의 (첨부파일 정보)
interface PaperGroupAttachment {
  id: number;
  downloadUri: string;
  mimeType: string;
  tag: string;
  originalName: string;
  size: number;
}

// PaperHub API 응답 타입 정의 (PaperGroup 상세 정보)
interface PaperGroupResultElement {
  id: string;
  section: number;
  owner: number;
  bookCode: number;
  pageStart: number;
  pageEnd: number;
  title: string;
  attachments: PaperGroupAttachment[];
}

// PaperHub API 응답 타입 정의 (PaperGroup 조회 결과)
interface PaperGroupResponse {
  kind: string;
  totalElements: number;
  resultElements: PaperGroupResultElement[];
}

// Paper 정보 조회 쿼리 파라미터 정의
interface PaperInfoQuery {
  section: string;
  owner: string;
  book: string;
  page: string;
}

// 클라이언트에 반환할 Paper 정보 응답 타입
interface PaperInfoResponse {
  paperGroupId: string;
  title: string;
  start: {
    section: number;
    owner: number;
    book: number;
    page: number;
  };
  end: {
    section: number;
    owner: number;
    book: number;
    page: number;
  };
  pageCount: number;
  pdfUrl: string | null;
  nprojUrl: string | null; // nproj 다운로드 URL (클라이언트에서 직접 다운로드)
}

/**
 * 페이퍼 허브(PaperHub) 관련 라우트 핸들러 (정보 조회)
 * 외부 PaperHub 서버와 통신하여 페이퍼 정보를 조회합니다.
 */
export async function paperHubPaperInfoRoutes(app: FastifyInstance): Promise<void> {
  /**
   * PaperHub 서버 정보 반환
   * PaperHub의 호스트 및 전체 URL 정보를 제공합니다.
   */
  app.get('/server-info', async (_request, reply) => {
    try {
      const paperHubUrl = ndpRouterService.getPaperHubUrl();
      const url = new URL(paperHubUrl);
      return reply.send({
        host: url.hostname,
        url: paperHubUrl,
      });
    } catch (error) {
      logger.error(error, 'Error parsing PaperHub URL');
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get PaperHub server info',
      });
    }
  });

  /**
   * 특정 NCode(Section, Owner, Book, Page)에 해당하는 페이퍼 정보 조회
   * PaperHub API를 호출하여 PDF 및 NProj URL 등을 가져옵니다.
   */
  app.get<{ Querystring: PaperInfoQuery }>('/', async (request, reply) => {
    const { section, owner, book, page } = request.query;

    // 필수 파라미터 검증
    if (!section || !owner || !book || !page) {
      return reply.status(400).send({
        error: 'MISSING_PARAMETERS',
        message: 'section, owner, book, page are required',
      });
    }

    const sectionNum = parseInt(section, 10);
    const ownerNum = parseInt(owner, 10);
    const bookNum = parseInt(book, 10);
    const pageNum = parseInt(page, 10);

    // 파라미터 타입 검증 (숫자여야 함)
    if (isNaN(sectionNum) || isNaN(ownerNum) || isNaN(bookNum) || isNaN(pageNum)) {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: 'section, owner, book, page must be valid integers',
      });
    }

    try {
      // section이 0-15 범위이면 먼저 로컬 nc-paperhub 확인
      if (sectionNum >= LOCAL_SECTION_MIN && sectionNum <= LOCAL_SECTION_MAX) {
        const sobKey = `${sectionNum}.${ownerNum}.${bookNum}`;
        logger.debug({ sobKey, page: pageNum }, 'Checking local nc-paperhub for section 0-15');

        // 로컬 nc-paperhub에서 페이퍼 조회 (페이지 범위 포함하여 검색)
        const localPaper = await ncPaperHubService.getPaperBySobKeyAndPage(sobKey, pageNum);

        if (localPaper) {
          logger.info({ paperGroupId: localPaper.paperGroupId, sobKey }, 'Found paper in local nc-paperhub');

          // 로컬 URL 생성 (상대 경로로 클라이언트가 직접 다운로드)
          const localPdfUrl = `/api/nc-paperhub/paper/${localPaper.paperGroupId}/pdf`;
          const localNprojUrl = `/api/nc-paperhub/paper/${localPaper.paperGroupId}/nproj`;

          const result: PaperInfoResponse = {
            paperGroupId: localPaper.paperGroupId,
            title: localPaper.title,
            start: {
              section: localPaper.section,
              owner: localPaper.owner,
              book: localPaper.book,
              page: localPaper.pageStart,
            },
            end: {
              section: localPaper.section,
              owner: localPaper.owner,
              book: localPaper.book,
              page: localPaper.pageEnd,
            },
            pageCount: localPaper.pageCount,
            pdfUrl: localPdfUrl,
            nprojUrl: localNprojUrl,
          };

          return reply.send(result);
        }
      }

      // 로컬에 없거나 section > 15인 경우, NDP PaperHub API 호출
      const token = await getNdpAccessToken();
      const paperHubUrl = ndpRouterService.getPaperHubUrl();
      const url = new URL('/paperhub/v2/papergroup', paperHubUrl);
      url.searchParams.set('section', section);
      url.searchParams.set('owner', owner);
      url.searchParams.set('bookCode', book);
      url.searchParams.set('page', page);

      logger.debug({ targetUrl: url.toString() }, 'Fetching PaperGroup info from NDP');

      // PaperHub API 요청
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, body: errorText }, 'PaperHub API error');
        return reply.status(response.status).send({
          error: 'PAPERHUB_ERROR',
          message: `PaperHub API returned ${response.status}`,
        });
      }

      const data = (await response.json()) as PaperGroupResponse;

      if (!data.resultElements || data.resultElements.length === 0) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'No PaperGroup found for the given section/owner/book/page',
        });
      }

      // 첫 번째 매칭되는 PaperGroup 사용
      const paperGroup = data.resultElements[0];

      // PDF 및 NPROJ 첨부파일 정보 찾기
      const pdfAttachment = paperGroup.attachments?.find(
        (att) => att.tag === 'pdf' || att.mimeType === 'application/pdf'
      );
      const nprojAttachment = paperGroup.attachments?.find(
        (att) => att.tag === 'nproj' || att.originalName?.endsWith('.nproj')
      );

      // nproj URL을 직접 전달 (클라이언트가 직접 다운로드하도록)
      // 서버가 트래픽을 중계하지 않음
      const nprojUrl = nprojAttachment?.downloadUri ?? null;
      if (nprojUrl) {
        logger.debug({ nprojUrl }, 'NPROJ URL provided for client download');
      }

      const result: PaperInfoResponse = {
        paperGroupId: paperGroup.id,
        title: paperGroup.title,
        start: {
          section: paperGroup.section,
          owner: paperGroup.owner,
          book: paperGroup.bookCode,
          page: paperGroup.pageStart,
        },
        end: {
          section: paperGroup.section,
          owner: paperGroup.owner,
          book: paperGroup.bookCode,
          page: paperGroup.pageEnd,
        },
        pageCount: paperGroup.pageEnd - paperGroup.pageStart + 1,
        pdfUrl: pdfAttachment?.downloadUri ?? null,
        nprojUrl,
      };

      return reply.send(result);
    } catch (error) {
      logger.error(error, 'Error fetching paper info');
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch paper info from PaperHub',
      });
    }
  });
}
