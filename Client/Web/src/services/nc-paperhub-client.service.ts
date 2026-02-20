/**
 * NcPaperHub Client Service
 *
 * 서버의 NcPaperHub API를 호출하는 클라이언트
 * - SOBP 할당 → 클라이언트에서 NPROJ 생성 → 서버에 첨부
 * - Paper 조회 및 다운로드
 * - Local PaperHub와 연동
 *
 * 흐름:
 * 1. 클라이언트: /allocate 호출 → SOBP 할당 받음
 * 2. 클라이언트: PDF 분석, NPROJ 생성
 * 3. 클라이언트: /attach 호출 → PDF/NPROJ 업로드
 */

import { authService } from './auth-service';
import { localPaperHubService } from './local-paperhub.service';
import type { LocalPaper, NcodePdfCompound } from './local-paperhub.service';
import type { SOBKey } from '../types/paper-info';
import { createSOBKey } from '../types/paper-info';
import { generateNprojFromPdf, getPdfPageCount } from './nproj-generator.service';

// ============================================
// Types
// ============================================

/**
 * SOBP 할당 결과
 */
export interface AllocateResult {
  success: boolean;
  paperGroupId: string;
  sobKey: SOBKey;
  section: number;
  owner: number;
  book: number;
  pageStart: number;
  pageEnd: number;
}

/**
 * Paper 첨부 결과 (클라이언트에서 NPROJ 생성 후 업로드)
 */
export interface AttachResult {
  success: boolean;
  paperGroupId: string;
  sobKey: SOBKey;
  ncode: {
    section: number;
    owner: number;
    book: number;
    pageStart: number;
    pageEnd: number;
  };
  title: string;
  pageCount: number;
  nprojXml: string;
}

/**
 * Paper 정보
 */
export interface PaperInfo {
  paperGroupId: string;
  sobKey: SOBKey;
  title: string;
  section: number;
  owner: number;
  book: number;
  pageStart: number;
  pageEnd: number;
  pageCount: number;
  createdAt: string;
}

/**
 * 서버 에러 응답
 */
interface ApiError {
  error: string;
  message: string;
}

// ============================================
// NcPaperHubClientService Class
// ============================================

class NcPaperHubClientService {
  private baseUrl: string;

  constructor() {
    // Vite 환경변수에서 API URL 가져오기
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    if (!apiBaseUrl || apiBaseUrl.startsWith('/')) {
      // Relative path or empty → use current origin (nginx proxy in production, Vite proxy in dev)
      this.baseUrl = typeof window === 'undefined' ? '' : window.location.origin;
    } else {
      // Absolute URL → remove /api suffix
      this.baseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
    }
  }

  // ============================================
  // API Helpers
  // ============================================

  /**
   * 인증 헤더 가져오기
   */
  private getAuthHeaders(): Record<string, string> {
    const token = authService.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * API 응답 처리
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'UNKNOWN', message: response.statusText }));
      throw new Error((errorData as ApiError).message || 'API request failed');
    }
    return response.json() as Promise<T>;
  }

  // ============================================
  // SOBP Allocation
  // ============================================

  /**
   * SOBP 할당 (PDF 없이 코드만 할당)
   */
  async allocateNcode(pageCount: number): Promise<AllocateResult> {
    const response = await fetch(`${this.baseUrl}/api/nc-paperhub/allocate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ pageCount }),
    });

    const data = await this.handleResponse<{
      success: boolean;
      paperGroupId: string;
      section: number;
      owner: number;
      book: number;
      pageStart: number;
      pageEnd: number;
      sobKey: string;
    }>(response);

    return {
      success: data.success,
      paperGroupId: data.paperGroupId,
      sobKey: data.sobKey as SOBKey,
      section: data.section,
      owner: data.owner,
      book: data.book,
      pageStart: data.pageStart,
      pageEnd: data.pageEnd,
    };
  }

  // ============================================
  // PDF Registration (Client-side NPROJ generation)
  // ============================================

  /**
   * PDF 업로드 및 등록
   * 1. SOBP 할당 요청 (/allocate)
   * 2. 클라이언트에서 NPROJ 생성
   * 3. PDF + NPROJ 첨부 (/attach)
   */
  async registerPaper(pdfFile: File, title?: string): Promise<AttachResult> {
    const documentTitle = title || pdfFile.name.replace(/\.pdf$/i, '');

    // 1. PDF에서 페이지 수 추출
    const pdfBuffer = await pdfFile.arrayBuffer();
    const pageCount = getPdfPageCount(pdfBuffer);

    console.log('[NcPaperHubClient] PDF analyzed:', { pageCount, title: documentTitle });

    // 2. SOBP 할당 요청
    const allocation = await this.allocateNcode(pageCount);
    console.log('[NcPaperHubClient] SOBP allocated:', allocation);

    // 3. 클라이언트에서 NPROJ 생성
    const nprojXml = generateNprojFromPdf(
      {
        section: allocation.section,
        owner: allocation.owner,
        book: allocation.book,
        pageStart: allocation.pageStart,
        pageEnd: allocation.pageEnd,
      },
      documentTitle,
      pdfBuffer
    );

    console.log('[NcPaperHubClient] NPROJ generated');

    // 4. PDF + NPROJ 첨부 요청
    const result = await this.attachPaper({
      paperGroupId: allocation.paperGroupId,
      sobKey: allocation.sobKey,
      title: documentTitle,
      section: allocation.section,
      owner: allocation.owner,
      book: allocation.book,
      pageStart: allocation.pageStart,
      pageEnd: allocation.pageEnd,
      pageCount,
      nprojXml,
      pdfFile,
    });

    return result;
  }

  /**
   * Paper 첨부 (PDF + NPROJ 업로드)
   */
  private async attachPaper(params: {
    paperGroupId: string;
    sobKey: SOBKey;
    title: string;
    section: number;
    owner: number;
    book: number;
    pageStart: number;
    pageEnd: number;
    pageCount: number;
    nprojXml: string;
    pdfFile: File;
  }): Promise<AttachResult> {
    const token = authService.getAccessToken();

    const formData = new FormData();
    formData.append('pdfFile', params.pdfFile);
    formData.append('nprojXml', params.nprojXml);
    formData.append('paperGroupId', params.paperGroupId);
    formData.append('sobKey', params.sobKey);
    formData.append('title', params.title);
    formData.append('section', params.section.toString());
    formData.append('owner', params.owner.toString());
    formData.append('book', params.book.toString());
    formData.append('pageStart', params.pageStart.toString());
    formData.append('pageEnd', params.pageEnd.toString());
    formData.append('pageCount', params.pageCount.toString());

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}/api/nc-paperhub/attach`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await this.handleResponse<{
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
    }>(response);

    return {
      success: data.success,
      paperGroupId: data.paperGroupId,
      sobKey: data.sobKey as SOBKey,
      ncode: data.ncode,
      title: data.title,
      pageCount: data.pageCount,
      nprojXml: params.nprojXml,
    };
  }

  /**
   * PDF 업로드 및 Local PaperHub에 저장
   * - 서버에 등록 후 Local PaperHub에도 저장
   */
  async registerAndSaveLocally(
    pdfFile: File,
    hostId: string,
    title?: string
  ): Promise<LocalPaper> {
    // 1. 서버에 등록
    const result = await this.registerPaper(pdfFile, title);

    // 2. Local PaperHub에 저장
    const pdfBlob = new Blob([await pdfFile.arrayBuffer()], { type: 'application/pdf' });

    await localPaperHubService.savePaper({
      hostId,
      paperGroupId: result.paperGroupId,
      sobKey: result.sobKey,
      title: result.title,
      section: result.ncode.section,
      owner: result.ncode.owner,
      book: result.ncode.book,
      pageStart: result.ncode.pageStart,
      pageEnd: result.ncode.pageEnd,
      pageCount: result.pageCount,
      nprojXml: result.nprojXml,
      pdfBlob,
    });

    // 3. 저장된 Paper 반환
    const paper = await localPaperHubService.getPaper(hostId, result.paperGroupId);
    if (!paper) {
      throw new Error('Failed to save paper locally');
    }
    return paper;
  }

  // ============================================
  // Paper Queries
  // ============================================

  /**
   * 사용자의 모든 Paper 목록 조회
   */
  async getPapers(): Promise<PaperInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/nc-paperhub/papers`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await this.handleResponse<{
      success: boolean;
      papers: Array<{
        paperGroupId: string;
        sobKey: string;
        title: string;
        section: number;
        owner: number;
        book: number;
        pageStart: number;
        pageEnd: number;
        pageCount: number;
        createdAt: string;
      }>;
    }>(response);

    return data.papers.map((p) => ({
      ...p,
      sobKey: p.sobKey as SOBKey,
    }));
  }

  /**
   * 특정 Paper 정보 조회
   */
  async getPaper(paperGroupId: string): Promise<PaperInfo | null> {
    const response = await fetch(`${this.baseUrl}/api/nc-paperhub/paper/${paperGroupId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (response.status === 404) {
      return null;
    }

    const data = await this.handleResponse<{
      success: boolean;
      paper: {
        paperGroupId: string;
        sobKey: string;
        title: string;
        section: number;
        owner: number;
        book: number;
        pageStart: number;
        pageEnd: number;
        pageCount: number;
        createdAt: string;
      };
    }>(response);

    return {
      ...data.paper,
      sobKey: data.paper.sobKey as SOBKey,
    };
  }

  /**
   * PDF 다운로드
   */
  async downloadPdf(paperGroupId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/nc-paperhub/paper/${paperGroupId}/pdf`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authService.getAccessToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download PDF');
    }

    return response.blob();
  }

  /**
   * NPROJ 다운로드
   */
  async downloadNproj(paperGroupId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/nc-paperhub/paper/${paperGroupId}/nproj`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authService.getAccessToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download NPROJ');
    }

    return response.text();
  }

  /**
   * Compound 다운로드 (PDF + NPROJ + 메타데이터)
   */
  async downloadCompound(paperGroupId: string): Promise<NcodePdfCompound> {
    const response = await fetch(`${this.baseUrl}/api/nc-paperhub/paper/${paperGroupId}/compound`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authService.getAccessToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download compound');
    }

    return response.json() as Promise<NcodePdfCompound>;
  }

  /**
   * Paper 삭제
   */
  async deletePaper(paperGroupId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/nc-paperhub/paper/${paperGroupId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (response.status === 404) {
      return false;
    }

    await this.handleResponse<{ success: boolean }>(response);
    return true;
  }

  // ============================================
  // SOBP Lookup
  // ============================================

  /**
   * SOBP로 Paper 조회 (로컬 + 서버 + NDP fallback)
   */
  async lookupPaper(
    hostId: string,
    section: number,
    owner: number,
    book: number,
    page?: number
  ): Promise<{ source: 'local' | 'server' | 'ndp'; paper: LocalPaper | null }> {
    // 1. Local PaperHub에서 먼저 조회
    const sobKey = createSOBKey(section, owner, book);
    let localPaper: LocalPaper | null = null;

    if (page !== undefined) {
      localPaper = await localPaperHubService.getPaperByAddress(hostId, section, owner, book, page);
    } else {
      localPaper = await localPaperHubService.getPaperBySOBKey(hostId, sobKey);
    }

    if (localPaper) {
      return { source: 'local', paper: localPaper };
    }

    // 2. 서버에서 조회
    try {
      const response = await fetch(`${this.baseUrl}/api/nc-paperhub/lookup`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ section, owner, book }),
      });

      if (response.ok) {
        const data = await response.json() as {
          success: boolean;
          source: 'local' | 'ndp';
          paper?: {
            paperGroupId: string;
            sobKey: string;
            title: string;
            pageCount: number;
            createdAt: string;
          };
        };

        if (data.success && data.paper) {
          // 서버에서 찾은 경우 compound 다운로드하여 로컬에 저장
          const compound = await this.downloadCompound(data.paper.paperGroupId);
          await localPaperHubService.savePaperFromCompound(compound);

          const savedPaper = await localPaperHubService.getPaper(hostId, data.paper.paperGroupId);
          return { source: data.source === 'ndp' ? 'ndp' : 'server', paper: savedPaper };
        }
      }
    } catch (error) {
      console.warn('[NcPaperHubClient] Server lookup failed:', error);
    }

    return { source: 'server', paper: null };
  }
}

// 싱글톤 인스턴스
export const ncPaperHubClientService = new NcPaperHubClientService();
