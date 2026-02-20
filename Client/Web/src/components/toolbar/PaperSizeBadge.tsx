import { useState, useRef, useEffect, useMemo } from 'react';
import { useStrokeStore } from '../../stores/stroke-store';
import { usePaperInfoStore } from '../../stores/paper-info-store';
import { PaperSize, PAPER_SIZES, isMousePage } from '../../types';
import { getSOBKeyFromAddress } from '../../types/paper-info';
import { paperInfoService } from '../../services/paper-info-service';

const PAPER_SIZE_OPTIONS: PaperSize[] = [PaperSize.A4, PaperSize.Letter, PaperSize.B4, PaperSize.A5];

interface PaperSizeBadgeProps {
  compact?: boolean;
}

/**
 * Paper Size 드롭다운 뱃지 (Top bar용)
 * compact: true일 때 아이콘만 표시
 */
export const PaperSizeBadge: React.FC<PaperSizeBadgeProps> = ({ compact = false }) => {
  const paperSize = useStrokeStore((state) => state.paperSize);
  const setPaperSize = useStrokeStore((state) => state.setPaperSize);
  const currentPageAddress = useStrokeStore((state) => state.currentPageAddress);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // paper-info 캐시 변경 감지를 위해 구독
  const cache = usePaperInfoStore((state) => state.cache);

  // 현재 페이지가 NPROJ 기반인지 확인
  const isNprojBased = useMemo(() => {
    if (isMousePage(currentPageAddress)) return false;
    const sobKey = getSOBKeyFromAddress(currentPageAddress);
    return cache.has(sobKey);
  }, [currentPageAddress, cache]);

  // NPROJ 기반일 때 페이지 크기 정보
  const nprojSizeInfo = useMemo(() => {
    if (!isNprojBased) return null;
    const size = paperInfoService.getPageSizeInPoints(currentPageAddress);
    if (!size) return null;
    // pt를 mm로 변환 (1pt = 0.3528mm)
    const widthMm = Math.round(size.widthPt * 0.3528);
    const heightMm = Math.round(size.heightPt * 0.3528);
    return { widthMm, heightMm };
  }, [isNprojBased, currentPageAddress]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentInfo = PAPER_SIZES[paperSize];

  // 표시할 이름 결정
  const displayName = isNprojBased ? 'Auto' : currentInfo.name;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 ${compact ? 'p-1.5' : 'px-2.5 py-1'} bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-medium text-gray-600 transition-colors border border-gray-200`}
        title={displayName}
      >
        <svg className={compact ? "w-4 h-4" : "w-3.5 h-3.5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {!compact && (
          <>
            <span>{displayName}</span>
            <svg className="w-3 h-3 hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {/* Auto 옵션 (NPROJ 기반일 때만 표시) */}
          {isNprojBased && (
            <>
              <div
                className="w-full px-3 py-2 text-left text-sm flex items-center justify-between bg-blue-50 text-blue-700"
              >
                <span>Auto</span>
                {nprojSizeInfo && (
                  <span className="text-xs text-blue-500">{nprojSizeInfo.widthMm}×{nprojSizeInfo.heightMm}</span>
                )}
              </div>
              <div className="border-t border-gray-200 my-1" />
              <div className="px-3 py-1 text-xs text-gray-400">Fallback 용지 크기</div>
            </>
          )}
          {PAPER_SIZE_OPTIONS.map((size) => {
            const info = PAPER_SIZES[size];
            // NPROJ 기반이면 어떤 옵션도 선택되지 않음
            const isSelected = !isNprojBased && paperSize === size;
            return (
              <button
                key={size}
                onClick={() => {
                  setPaperSize(size);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <span>{info.name}</span>
                <span className="text-xs text-gray-500">{info.widthMm}×{info.heightMm}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PaperSizeBadge;
