// 데모용 paper-info-service 스텁
// 마우스 페이지는 paper info가 없으므로 항상 null 반환 — StrokeCanvas가 fallback 사용
import type { NcodePageAddress } from '../types/neocast';

export const paperInfoService = {
  getPageSizeInPoints(_pageAddress: NcodePageAddress): null {
    return null;
  },
  getCropMarginInPoints(_pageAddress: NcodePageAddress): null {
    return null;
  },
  async requestPaperInfo(_pageAddress: NcodePageAddress): Promise<null> {
    return null;
  },
};
