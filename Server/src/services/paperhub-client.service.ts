/**
 * PaperHub 클라이언트 서비스
 * NDP PaperHub API를 통해 NCode 할당 및 페이퍼 그룹(Paper Group) 생성을 처리합니다.
 */

import { getNdpAccessToken } from './ndp-token.service.js';
import { ndpRouterService } from './ndp-router.service.js';
import { logger } from '../utils/logger.js';

// ============================================
// Types
// ============================================

export interface NCodeResponse {
  section: number;
  owner: number;
  bookCode: number;
  pageStart: number;
  pageEnd: number;
  unique: boolean;
}

export interface PaperGroupResponse {
  id: string;
  section: number;
  owner: number;
  bookCode: number;
  pageStart: number;
  pageEnd: number;
  progressStatus: string;
  title: string;
}

export interface PaperGroupInfo {
  title: string;
  tag?: string;
  accessScope?: 'PUBLIC' | 'PRIVATE';
  unique?: boolean;
}

interface PaperHubNCodeApiResponse {
  section: number;
  owner: number;
  bookCode: number;
  pageStart: number;
  pageEnd: number;
  unique: boolean;
}

interface PaperHubPaperGroupApiResponse {
  id: string;
  section: number;
  owner: number;
  bookCode: number;
  pageStart: number;
  pageEnd: number;
  progressStatus?: string;
  title?: string;
}

// ============================================
// PaperHub Client Service implementation
// ============================================

class PaperHubClientService {
  /**
   * 인증 헤더 생성
   * NDP 액세스 토큰을 발급받아 헤더에 포함시킵니다.
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getNdpAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
  }

  /**
   * PaperHub Base URL 조회
   * ndp-router 서비스를 통해 URL을 가져옵니다.
   */
  private getPaperHubUrl(): string {
    return ndpRouterService.getPaperHubUrl();
  }

  /**
   * PaperHub로부터 NCode 할당 요청
   *
   * @param section NCode 섹션 (예: 5)
   * @param qty 할당할 페이지 수
   * @param unique 유니크 코드 여부
   * @param owner 오너 값 (선택)
   * @returns 할당된 NCode 정보
   */
  async allocateNCode(
    section: number,
    qty: number,
    unique: boolean = true,
    owner?: number
  ): Promise<NCodeResponse> {
    const baseUrl = this.getPaperHubUrl();
    const url = new URL('/paperhub/v2/ncode', baseUrl);
    url.searchParams.set('section', String(section));
    url.searchParams.set('qty', String(qty));
    url.searchParams.set('unique', String(unique));
    if (owner !== undefined) {
      url.searchParams.set('owner', String(owner));
    }

    logger.info({ section, owner, qty, unique }, 'Requesting NCode allocation');

    const headers = await this.getAuthHeaders();
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, body: errorText }, 'NCode allocation failed');
      throw new Error(`NCode allocation failed: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as PaperHubNCodeApiResponse;

    logger.info(
      { section: data.section, owner: data.owner, bookCode: data.bookCode },
      'NCode allocated successfully'
    );

    return {
      section: data.section,
      owner: data.owner,
      bookCode: data.bookCode,
      pageStart: data.pageStart,
      pageEnd: data.pageEnd,
      unique: data.unique,
    };
  }

  /**
   * 오너(Owner) 폴백 로직을 포함한 NCode 할당
   * 지정된 startOwner로 할당 실패 시, startOwner-1 부터 minOwner 까지 반복 시도합니다.
   *
   * @param section NCode 섹션
   * @param qty 페이지 수
   * @param startOwner 시도할 초기 오너 값
   * @param minOwner 최소 오너 값
   * @param unique 유니크 코드 여부
   * @returns 할당된 NCode 정보와 실제 사용된 오너 값
   */
  async allocateNCodeWithFallback(
    section: number,
    qty: number,
    startOwner: number = 256,
    minOwner: number = 0,
    unique: boolean = true
  ): Promise<{ ncode: NCodeResponse; actualOwner: number }> {
    let currentOwner = startOwner;
    let lastError: Error | null = null;

    while (currentOwner >= minOwner) {
      try {
        const ncode = await this.allocateNCode(section, qty, unique, currentOwner);
        logger.info({ owner: currentOwner }, 'NCode allocated with owner');
        return { ncode, actualOwner: currentOwner };
      } catch (error) {
        lastError = error as Error;
        logger.warn({ owner: currentOwner, error: lastError.message }, 'NCode allocation failed, trying next owner');
        currentOwner -= 1;
      }
    }

    throw new Error(
      `Failed to allocate NCode after trying owners ${startOwner} to ${minOwner}. Last error: ${lastError?.message}`
    );
  }

  /**
   * PDF 파일과 NPROJ 파일을 사용하여 Paper Group 생성
   *
   * @param pdfBuffer PDF 파일 버퍼
   * @param pdfFilename 원본 PDF 파일명
   * @param nprojContent NPROJ XML 내용
   * @param paperGroupInfo 페이퍼 그룹 메타데이터
   * @returns 생성된 페이퍼 그룹 정보
   */
  async createPaperGroupWithPdf(
    pdfBuffer: Buffer,
    pdfFilename: string,
    nprojContent: string,
    paperGroupInfo: PaperGroupInfo
  ): Promise<PaperGroupResponse> {
    const baseUrl = this.getPaperHubUrl();
    const url = `${baseUrl}/paperhub/v2/papergroup/pdf`;

    logger.info({ filename: pdfFilename, title: paperGroupInfo.title }, 'Creating Paper Group with PDF');

    const token = await getNdpAccessToken();

    // 멀티파트 폼 데이터 수동 구성 (node-fetch 등이 FormData를 완벽 지원하지 않을 경우 대비)
    const boundary = `----FormBoundary${Date.now()}`;

    const parts: Buffer[] = [];

    // PDF 파일 파트
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="pdfFile"; filename="${pdfFilename}"\r\n` +
      `Content-Type: application/pdf\r\n\r\n`
    ));
    parts.push(pdfBuffer);
    parts.push(Buffer.from('\r\n'));

    // NPROJ 파일 파트
    const nprojFilename = `${pdfFilename.replace(/\.pdf$/i, '')}.nproj`;
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="nprojFile"; filename="${nprojFilename}"\r\n` +
      `Content-Type: application/xml\r\n\r\n`
    ));
    parts.push(Buffer.from(nprojContent, 'utf-8'));
    parts.push(Buffer.from('\r\n'));

    // Paper group 정보 파트
    const infoJson = JSON.stringify({
      title: paperGroupInfo.title,
      tag: paperGroupInfo.tag || 'livecast',
      accessScope: paperGroupInfo.accessScope || 'PUBLIC',
      unique: paperGroupInfo.unique ?? true,
    });
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="paperGroupInfo"\r\n` +
      `Content-Type: application/json\r\n\r\n`
    ));
    parts.push(Buffer.from(infoJson, 'utf-8'));
    parts.push(Buffer.from('\r\n'));

    // 종료 바운더리
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, body: errorText }, 'Paper Group creation failed');
      throw new Error(`Paper Group creation failed: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as PaperHubPaperGroupApiResponse;

    logger.info(
      { id: data.id, section: data.section, owner: data.owner, bookCode: data.bookCode },
      'Paper Group created successfully'
    );

    return {
      id: data.id,
      section: data.section,
      owner: data.owner,
      bookCode: data.bookCode,
      pageStart: data.pageStart,
      pageEnd: data.pageEnd,
      progressStatus: data.progressStatus || 'CREATED',
      title: data.title || '',
    };
  }

  /**
   * ID로 페이퍼 그룹 정보 조회
   */
  async getPaperGroup(paperGroupId: string): Promise<PaperHubPaperGroupApiResponse> {
    const baseUrl = this.getPaperHubUrl();
    const url = `${baseUrl}/paperhub/v2/papergroup/${paperGroupId}`;

    const headers = await this.getAuthHeaders();
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Get Paper Group failed: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<PaperHubPaperGroupApiResponse>;
  }
}

// 싱글톤 인스턴스 export
export const paperHubClientService = new PaperHubClientService();
