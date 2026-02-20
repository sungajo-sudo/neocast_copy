/**
 * PDF 배경 캔버스 컴포넌트
 * PDF 페이지를 캔버스 배경으로 렌더링
 */

import React, { useEffect, useRef, useCallback } from 'react';
import type { NcodePageAddress } from '../../types';
import type { CachedPaperInfo } from '../../types/paper-info';
import { getSOBKeyFromAddress } from '../../types/paper-info';
import { getPdfPageIndex } from '../../utils/nprojUtils';
import { paperInfoService } from '../../services/paper-info-service';
import {
  pdfBackgroundService,
  PRIORITY_CURRENT,
} from '../../services/pdf-background-service';
import { isMousePage } from '../../types';

interface BackgroundCanvasProps {
  pageAddress: NcodePageAddress;
  width: number; // CSS pixels
  height: number; // CSS pixels
  scale: number; // 캔버스 스케일
}

export const BackgroundCanvas: React.FC<BackgroundCanvasProps> = ({
  pageAddress,
  width,
  height,
  scale,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // ref로 변경하여 무한 루프 방지
  const currentRenderRequestIdRef = useRef<string | null>(null);

  // 배경 렌더링
  const renderBackground = useCallback(
    async (cachedInfo: CachedPaperInfo) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // PDF 페이지 인덱스 계산
      const pdfPageIndex = getPdfPageIndex(cachedInfo.nprojJson, pageAddress.page);
      console.log('[BackgroundCanvas] Debug:', {
        requestedPage: pageAddress.page,
        nprojStartPage: cachedInfo.nprojJson.book.start_page,
        nprojPagesLength: cachedInfo.nprojJson.pages.length,
        calculatedPdfPageIndex: pdfPageIndex,
        cachedStartPage: cachedInfo.startPage,
        cachedEndPage: cachedInfo.endPage,
      });
      if (pdfPageIndex < 0) {
        console.warn('[BackgroundCanvas] Invalid page index:', pageAddress.page);
        return;
      }

      const sobKey = getSOBKeyFromAddress(pageAddress);

      // PDF가 로드되어 있는지 확인
      const currentSobKey = pdfBackgroundService.getCurrentSobKey();
      if (currentSobKey !== sobKey) {
        // 새 PDF 로드
        try {
          await pdfBackgroundService.initWithPdf(sobKey, cachedInfo.pdfBlob);
        } catch (e) {
          console.error('[BackgroundCanvas] Failed to load PDF:', e);
          return;
        }
      }

      // 기존 렌더링 요청 취소
      if (currentRenderRequestIdRef.current) {
        pdfBackgroundService.cancelRender(currentRenderRequestIdRef.current);
      }

      // 렌더링 스케일 계산 (devicePixelRatio 고려)
      const dpr = window.devicePixelRatio || 1;
      const renderScale = scale * dpr;

      const requestId = pdfBackgroundService.requestRenderWithCallback(
        pdfPageIndex,
        renderScale,
        (result) => {
          // 요청 ID가 다르면 무시 (이전 요청의 결과)
          if (currentRenderRequestIdRef.current !== requestId) {
            if (result.imageBitmap) {
              result.imageBitmap.close();
            }
            return;
          }

          if (result.error) {
            console.error('[BackgroundCanvas] Render error:', result.error);
            return;
          }

          if (!result.imageBitmap) {
            return;
          }

          // 캔버스에 그리기
          const canvas = canvasRef.current;
          if (!canvas) {
            result.imageBitmap.close();
            return;
          }

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            result.imageBitmap.close();
            return;
          }

          // 캔버스 클리어
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // ImageBitmap 그리기
          try {
            ctx.drawImage(
              result.imageBitmap,
              0,
              0,
              canvas.width,
              canvas.height
            );
          } catch (e) {
            console.error('[BackgroundCanvas] Draw error:', e);
          }

          // ImageBitmap 해제
          result.imageBitmap.close();
        },
        PRIORITY_CURRENT
      );

      currentRenderRequestIdRef.current = requestId;
    },
    [pageAddress, scale]
  );

  // 페이지 변경 시 배경 로드
  useEffect(() => {
    // 마우스 페이지는 배경 없음
    if (isMousePage(pageAddress)) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    let cancelled = false;

    const loadBackground = async () => {
      try {
        // PaperInfo 요청 (캐시 우선)
        const cachedInfo = await paperInfoService.requestPaperInfo(pageAddress);

        if (cancelled) return;

        if (!cachedInfo) {
          // PaperInfo 없음 - 흰색 배경
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
          }
          return;
        }

        // 배경 렌더링
        await renderBackground(cachedInfo);
      } catch (e) {
        if (!cancelled) {
          console.error('[BackgroundCanvas] Load error:', e);
        }
      }
    };

    loadBackground();

    return () => {
      cancelled = true;
      if (currentRenderRequestIdRef.current) {
        pdfBackgroundService.cancelRender(currentRenderRequestIdRef.current);
        currentRenderRequestIdRef.current = null;
      }
    };
  }, [pageAddress, renderBackground]);

  // 스케일 변경 시 재렌더링
  useEffect(() => {
    if (isMousePage(pageAddress)) return;

    const cachedInfo = paperInfoService.getCachedPaperInfo(pageAddress);
    if (cachedInfo) {
      renderBackground(cachedInfo);
    }
  }, [scale, pageAddress, renderBackground]);

  // 캔버스 크기 설정
  const dpr = window.devicePixelRatio || 1;
  const canvasWidth = Math.floor(width * scale * dpr);
  const canvasHeight = Math.floor(height * scale * dpr);

  return (
    <div
      className="absolute inset-0"
      style={{
        width: width * scale,
        height: height * scale,
      }}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="absolute inset-0"
        style={{
          width: width * scale,
          height: height * scale,
          backgroundColor: '#ffffff',
        }}
      />
    </div>
  );
};
