/**
 * NcPaperHub 서비스
 * 이용자별 SOBP 할당 및 페이퍼 관리
 *
 * 할당 순서: Page 순차 → Book 순차 → Owner 역순
 * - Page overflow → Book 증가
 * - Book overflow → Owner 감소
 *
 * NPROJ는 클라이언트에서 생성하여 서버로 업로드
 * IStorageProvider를 사용하여 로컬/GCS 모두 지원
 */

import { prisma } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';
import { getStorageProvider, IStorageProvider, STORAGE_BUCKETS } from './storage/index.js';

// ============================================
// Constants
// ============================================

const LOCAL_SECTION = 5;           // 고정 섹션
const LOCAL_OWNER_START = 255;     // 시작 오너 (감소 방향)
const LOCAL_OWNER_MIN = 0;         // 최소 오너
const LOCAL_START_BOOK = 0;        // 시작 북
const BOOK_MAX_VALUE = 4095;       // 12-bit max
const PAGE_MAX_VALUE = 4095;       // 12-bit max

// ============================================
// Types
// ============================================

export interface AllocateNcodeRequest {
  userId: string;
  pageCount: number;
  section?: number;
  owner?: number;
}

export interface AllocateNcodeResult {
  paperGroupId: string;
  section: number;
  owner: number;
  book: number;
  pageStart: number;
  pageEnd: number;
  sobKey: string;
}

/**
 * Paper 첨부 요청 (클라이언트에서 SOBP 할당 후 PDF/NPROJ 업로드)
 */
export interface AttachPaperRequest {
  userId: string;
  paperGroupId: string;
  sobKey: string;
  title: string;
  section: number;
  owner: number;
  book: number;
  pageStart: number;
  pageEnd: number;
  pageCount: number;
  nprojXml: string;
  pdfBuffer: Buffer;
}

export interface AttachPaperResult {
  paperGroupId: string;
  sobKey: string;
  section: number;
  owner: number;
  book: number;
  pageStart: number;
  pageEnd: number;
  pageCount: number;
  title: string;
  pdfPath: string;
  nprojPath: string;
}

export interface PaperInfo {
  paperGroupId: string;
  userId: string;
  sobKey: string;
  title: string;
  section: number;
  owner: number;
  book: number;
  pageStart: number;
  pageEnd: number;
  pageCount: number;
  nprojXml: string;
  pdfPath: string;
  createdAt: Date;
}

// ============================================
// NcPaperHub Service
// ============================================

class NcPaperHubService {
  private storage: IStorageProvider;

  constructor() {
    this.storage = getStorageProvider();
  }

  /**
   * 이용자별 SOBP 할당
   * 할당 순서: Page 순차 → Book 순차 → Owner 역순
   * - Page overflow → Book 증가
   * - Book overflow → Owner 감소
   */
  async allocateNcode(request: AllocateNcodeRequest): Promise<AllocateNcodeResult> {
    const { userId, pageCount, section = LOCAL_SECTION, owner } = request;

    if (pageCount <= 0 || pageCount > PAGE_MAX_VALUE + 1) {
      throw new Error(`Invalid page count: ${pageCount}`);
    }

    // 현재 할당 상태 조회 또는 생성
    let allocation = await prisma.ncodeAllocation.findFirst({
      where: { userId, section, owner: owner ?? LOCAL_OWNER_START },
    });

    if (!allocation) {
      // 새로운 할당 상태 생성
      allocation = await prisma.ncodeAllocation.create({
        data: {
          userId,
          section,
          owner: owner ?? LOCAL_OWNER_START,
          currentBook: LOCAL_START_BOOK,
          nextPage: 0,
        },
      });
    }

    let currentOwner = allocation.owner;
    let currentBook = allocation.currentBook;
    let currentPage = allocation.nextPage;

    // 페이지가 현재 북에 들어가는지 확인 (Page overflow → Book 증가)
    if (currentPage + pageCount - 1 > PAGE_MAX_VALUE) {
      // 새 북으로 이동
      currentBook++;
      currentPage = 0;

      // Book overflow → Owner 감소
      if (currentBook > BOOK_MAX_VALUE) {
        currentOwner--;
        currentBook = 0;

        if (currentOwner < LOCAL_OWNER_MIN) {
          throw new Error('All owners exhausted for this user');
        }
      }
    }

    const pageStart = currentPage;
    const pageEnd = currentPage + pageCount - 1;
    const nextPage = pageEnd + 1;

    // 할당 상태 업데이트
    await prisma.ncodeAllocation.upsert({
      where: {
        userId_section_owner: {
          userId,
          section,
          owner: currentOwner,
        },
      },
      update: {
        currentBook,
        nextPage: nextPage > PAGE_MAX_VALUE ? 0 : nextPage,
      },
      create: {
        userId,
        section,
        owner: currentOwner,
        currentBook,
        nextPage: nextPage > PAGE_MAX_VALUE ? 0 : nextPage,
      },
    });

    const paperGroupId = randomUUID();
    const sobKey = `${section}.${currentOwner}.${currentBook}`;

    logger.info(
      { userId, paperGroupId, section, owner: currentOwner, book: currentBook, pageStart, pageEnd },
      'NCode allocated for user'
    );

    return {
      paperGroupId,
      section,
      owner: currentOwner,
      book: currentBook,
      pageStart,
      pageEnd,
      sobKey,
    };
  }

  /**
   * Paper 첨부 (클라이언트에서 생성한 PDF/NPROJ 저장)
   * 클라이언트가 allocateNcode로 SOBP를 할당받은 후,
   * PDF와 NPROJ를 생성하여 이 메서드로 업로드합니다.
   */
  async attachPaper(request: AttachPaperRequest): Promise<AttachPaperResult> {
    const {
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
    } = request;

    // 스토리지 경로: {userId}/{paperGroupId}.pdf, {userId}/{paperGroupId}.nproj
    const pdfKey = `${userId}/${paperGroupId}.pdf`;
    const nprojKey = `${userId}/${paperGroupId}.nproj`;

    // PDF 파일 저장
    await this.storage.save(STORAGE_BUCKETS.PAPERS, pdfKey, pdfBuffer, {
      contentType: 'application/pdf',
      metadata: {
        userId,
        paperGroupId,
        sobKey,
        title,
      },
    });

    // NPROJ 파일 저장
    await this.storage.save(STORAGE_BUCKETS.PAPERS, nprojKey, Buffer.from(nprojXml, 'utf-8'), {
      contentType: 'application/xml',
      metadata: {
        userId,
        paperGroupId,
        sobKey,
        title,
      },
    });

    // DB에 저장 (pdfPath는 스토리지 키로 저장)
    await prisma.userPaper.create({
      data: {
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
        pdfPath: pdfKey,  // 스토리지 키로 저장
        pdfSize: pdfBuffer.length,
      },
    });

    logger.info(
      { userId, paperGroupId, sobKey, title, pageCount },
      'Paper attached'
    );

    return {
      paperGroupId,
      sobKey,
      section,
      owner,
      book,
      pageStart,
      pageEnd,
      pageCount,
      title,
      pdfPath: pdfKey,
      nprojPath: nprojKey,
    };
  }

  /**
   * 페이퍼 정보 조회
   */
  async getPaper(userId: string, sobKey: string): Promise<PaperInfo | null> {
    const paper = await prisma.userPaper.findFirst({
      where: { userId, sobKey },
    });

    if (!paper) {
      return null;
    }

    return {
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
      pdfPath: paper.pdfPath,
      createdAt: paper.createdAt,
    };
  }

  /**
   * SOB 키와 페이지 번호로 페이퍼 조회 (사용자 무관)
   * 모든 사용자의 페이퍼 중에서 해당 SOB 키를 가지고 페이지가 범위 내인 페이퍼를 찾습니다.
   */
  async getPaperBySobKeyAndPage(sobKey: string, page: number): Promise<PaperInfo | null> {
    const paper = await prisma.userPaper.findFirst({
      where: {
        sobKey,
        pageStart: { lte: page },
        pageEnd: { gte: page },
      },
    });

    if (!paper) {
      return null;
    }

    return {
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
      pdfPath: paper.pdfPath,
      createdAt: paper.createdAt,
    };
  }

  /**
   * paperGroupId로 페이퍼 조회
   */
  async getPaperByGroupId(paperGroupId: string): Promise<PaperInfo | null> {
    const paper = await prisma.userPaper.findUnique({
      where: { paperGroupId },
    });

    if (!paper) {
      return null;
    }

    return {
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
      pdfPath: paper.pdfPath,
      createdAt: paper.createdAt,
    };
  }

  /**
   * PDF 파일 읽기
   */
  async getPdfBuffer(paperGroupId: string): Promise<Buffer | null> {
    const paper = await prisma.userPaper.findUnique({
      where: { paperGroupId },
    });

    if (!paper) {
      return null;
    }

    // 스토리지에서 읽기
    const storageFile = await this.storage.get(STORAGE_BUCKETS.PAPERS, paper.pdfPath);
    if (!storageFile) {
      logger.error({ pdfPath: paper.pdfPath }, 'Failed to read PDF file from storage');
      return null;
    }

    return storageFile.buffer;
  }

  /**
   * 사용자의 모든 페이퍼 목록 조회
   */
  async getUserPapers(userId: string): Promise<PaperInfo[]> {
    const papers = await prisma.userPaper.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return papers.map((paper) => ({
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
      pdfPath: paper.pdfPath,
      createdAt: paper.createdAt,
    }));
  }

  /**
   * 페이퍼 삭제
   */
  async deletePaper(paperGroupId: string): Promise<boolean> {
    const paper = await prisma.userPaper.findUnique({
      where: { paperGroupId },
    });

    if (!paper) {
      return false;
    }

    // PDF 파일 삭제
    try {
      await this.storage.delete(STORAGE_BUCKETS.PAPERS, paper.pdfPath);
    } catch (error) {
      logger.warn({ error, pdfPath: paper.pdfPath }, 'Failed to delete PDF file from storage');
    }

    // NPROJ 파일 삭제
    try {
      const nprojKey = paper.pdfPath.replace(/\.pdf$/, '.nproj');
      await this.storage.delete(STORAGE_BUCKETS.PAPERS, nprojKey);
    } catch (error) {
      // NPROJ 파일이 없을 수 있음 (이전 버전 호환)
    }

    // DB에서 삭제
    await prisma.userPaper.delete({
      where: { paperGroupId },
    });

    logger.info({ paperGroupId }, 'Paper deleted');
    return true;
  }

  /**
   * SOBP로 페이퍼 조회 (NDP fallback 포함)
   * 로컬에 없으면 NDP PaperHub API로 조회 시도
   */
  async getPaperWithFallback(
    userId: string,
    section: number,
    owner: number,
    book: number
  ): Promise<{ source: 'local' | 'ndp'; paper: PaperInfo | null; ndpUrl?: string }> {
    const sobKey = `${section}.${owner}.${book}`;

    // 로컬 조회
    const localPaper = await this.getPaper(userId, sobKey);
    if (localPaper) {
      return { source: 'local', paper: localPaper };
    }

    // NDP fallback - 여기서는 URL만 반환 (실제 저장은 하지 않음)
    try {
      // NDP PaperHub API로 nproj URL 조회 시도
      // 실제 구현은 paperhub-client.service.ts의 API 사용
      logger.info({ section, owner, book }, 'Paper not found locally, would fallback to NDP');

      // TODO: NDP API 호출하여 nproj/pdf URL 반환
      return { source: 'ndp', paper: null };
    } catch (error) {
      logger.warn({ error, section, owner, book }, 'NDP fallback failed');
      return { source: 'ndp', paper: null };
    }
  }
}

// 싱글톤 인스턴스
export const ncPaperHubService = new NcPaperHubService();
