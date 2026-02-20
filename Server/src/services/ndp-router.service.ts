/**
 * NDP Router Service
 * Production 환경의 NDP 라우터에서 동적으로 각 서비스(Gateway, Auth, PaperHub 등)의 URL을 가져와 설정합니다.
 */

import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

interface RouterResponse {
  url?: string;
}

interface GatewayResponse {
  resultElements?: GatewayResponseItem[];
}

interface GatewayResponseItem {
  type: string;
  url: string;
}

interface ServerUrlMap {
  AUTH?: string;
  PAPER?: string;
  INK?: string;
  USER?: string;
  IMAGE?: string;
  RELAY?: string;
  STORAGE?: string;
  [key: string]: string | undefined;
}

class NdpRouterService {
  private serversMap: ServerUrlMap = {};
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * 라우터에서 서버 URL을 가져와 초기화
   * 중복 호출 시 이미 시작된 초기화 프로미스를 반환하여 중복 요청 방지
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    const { routerUrl, applicationId, resourceOwnerId } = config.ndp;

    if (!routerUrl) {
      logger.warn('NDP Router URL not configured, using default URLs');
      this.initialized = true;
      return;
    }

    try {
      // 1. Router에서 Gateway URL 가져오기
      const routerEndpoint = `${routerUrl}/gateway/v2/router/client?applicationId=${applicationId}&resourceOwnerId=${resourceOwnerId}`;
      logger.info({ routerEndpoint }, 'Fetching NDP gateway URL from router');

      const routerRes = await fetch(routerEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!routerRes.ok) {
        throw new Error(`Router request failed: ${routerRes.status}`);
      }

      const routerData = (await routerRes.json()) as RouterResponse;
      const gatewayServer = routerData?.url;

      if (!gatewayServer) {
        throw new Error('Invalid gateway URL from router');
      }

      logger.info({ gatewayServer }, 'Got gateway server URL');

      // 2. Gateway에서 서버 URL 목록 가져오기
      const gatewayEndpoint = `${gatewayServer}/gateway/v2/server?applicationId=${applicationId}&resourceOwnerId=${resourceOwnerId}`;
      logger.info({ gatewayEndpoint }, 'Fetching server URLs from gateway');

      const gatewayRes = await fetch(gatewayEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!gatewayRes.ok) {
        throw new Error(`Gateway request failed: ${gatewayRes.status}`);
      }

      const gatewayData = (await gatewayRes.json()) as GatewayResponse;
      const servers = gatewayData?.resultElements;

      if (servers && Array.isArray(servers)) {
        for (const item of servers) {
          // URL 끝에 슬래시가 있다면 제거
          let url = item.url;
          if (url.endsWith('/')) {
            url = url.slice(0, -1);
          }
          this.serversMap[item.type] = url;
        }
        logger.info({ serversMap: this.serversMap }, 'NDP server URLs loaded from router');
      }

      this.initialized = true;
    } catch (error) {
      logger.error(error, 'Failed to get NDP server URLs from router, using defaults');
      this.initialized = true;
    }
  }

  /**
   * AUTH 서버 URL 반환
   */
  getAuthUrl(): string {
    return this.serversMap.AUTH || config.ndp.authUrl;
  }

  /**
   * PaperHub (PAPER) 서버 URL 반환
   */
  getPaperHubUrl(): string {
    return this.serversMap.PAPER || config.ndp.paperHubUrl;
  }

  /**
   * INK 서버 URL 반환
   */
  getInkUrl(): string | null {
    return this.serversMap.INK || null;
  }

  /**
   * USER 서버 URL 반환
   */
  getUserUrl(): string | null {
    return this.serversMap.USER || null;
  }

  /**
   * 특정 타입의 서버 URL 반환
   */
  getServerUrl(type: string): string | null {
    return this.serversMap[type] || null;
  }

  /**
   * 전체 서버 맵 반환
   */
  getServersMap(): ServerUrlMap {
    return { ...this.serversMap };
  }
}

export const ndpRouterService = new NdpRouterService();
