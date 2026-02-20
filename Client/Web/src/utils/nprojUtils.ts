/**
 * NPROJ 파일 파싱 유틸리티
 * neostudio2의 nprojToJson.ts를 기반으로 브라우저 환경에 맞게 포팅
 */

import type {
  NprojJson,
  NprojPageJson,
  PuiSymbolType,
  IPageSOBP,
} from '../types/paper-info';

// ============================================
// 상수 정의 (ncode-constants에서 포팅)
// ============================================

/**
 * PDF Unit → Ncode Unit 변환 상수
 * 1 PU = 1/72 inch, 1 NU = 1/600 inch * 8 * 7
 */
export const PU_TO_NU = 0.148809523809524;

/**
 * Ncode Unit → PDF Unit 변환 상수
 */
export const NU_TO_PU = 6.72; // = 56 / 600 * 72

// ============================================
// 헬퍼 함수
// ============================================

/**
 * XML 요소에서 텍스트 콘텐츠 가져오기
 */
function getTextContent(element: Element, selector: string): string {
  const foundElement = element.querySelector(selector);
  return foundElement ? foundElement.textContent || '' : '';
}

// ============================================
// NPROJ 파싱 함수
// ============================================

/**
 * base64 인코딩된 NPROJ를 디코딩
 */
export function decodeNprojBase64(base64: string): string {
  try {
    // base64 → binary string → UTF-8 디코딩
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    console.error('Failed to decode nproj base64:', e);
    throw new Error('Invalid nproj base64 data');
  }
}

/**
 * NPROJ XML 문자열을 JSON으로 파싱
 * 두 가지 형식을 지원:
 * 1. NeoStudio 형식: <book>...</book><pages count="N"><page_item>...</page_item></pages>
 * 2. Simplified 형식: <nproj><title>...</title><pages><page>...</page></pages></nproj>
 */
export function nprojToJson(nproj: string): NprojJson {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(nproj, 'text/xml');

  // 파싱 에러 확인
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`NPROJ XML parsing error: ${parseError.textContent}`);
  }

  // NeoStudio 형식 확인 (book 요소가 있는 경우)
  const bookXml = xmlDoc.querySelector('book');

  // Simplified 형식 확인 (nproj 루트 요소)
  const nprojRoot = xmlDoc.querySelector('nproj');
  const isSimplifiedFormat = !bookXml && nprojRoot;

  // 메타데이터 추출 (형식에 따라 다른 소스 사용)
  const metaSource = bookXml || nprojRoot || xmlDoc.documentElement;

  const title = getTextContent(metaSource, 'title');
  const author = getTextContent(metaSource, 'author');

  const section = parseInt(getTextContent(metaSource, 'section'), 10);
  const owner = parseInt(getTextContent(metaSource, 'owner'), 10);
  // NeoStudio: <code>, Simplified: <book>
  const bookNum = parseInt(getTextContent(metaSource, 'code') || getTextContent(metaSource, 'book'), 10);
  let startPage = parseInt(getTextContent(metaSource, 'start_page'), 10);

  // segment_info에서 실제 ncode 시작 페이지 확인 (우선순위 높음)
  const segment_info = metaSource.querySelector('segment_info');
  const ncode_start_page_str = segment_info
    ? segment_info.getAttribute('ncode_start_page')
    : null;
  if (ncode_start_page_str) {
    const start_page_new = parseInt(ncode_start_page_str, 10);
    startPage = start_page_new;
  }

  // extra_info 파싱
  const extra = getTextContent(metaSource, 'extra_info');
  let extra_info: Record<string, string> = {};
  if (extra) {
    const parts = extra.split('=');
    if (parts.length >= 2) {
      extra_info[parts[0]] = parts[1];
    }
  }

  const kind = parseInt(getTextContent(metaSource, 'kind') || '0', 10);

  // offset 파싱 (Moleskine 등 특수 용지용)
  let offset: { left: number; top: number } = { left: 0, top: 0 };
  const _offset = metaSource.querySelector('offset');
  if (_offset) {
    const leftAttr = _offset.getAttribute('left');
    const topAttr = _offset.getAttribute('top');
    if (leftAttr && topAttr) {
      offset = {
        left: parseFloat(leftAttr),
        top: parseFloat(topAttr),
      };
    }
  }

  // PDF 정보
  const pdfXml = xmlDoc.querySelector('pdf');
  const filename = pdfXml ? getTextContent(pdfXml, 'path') : '';

  // 페이지 정보
  const pages = xmlDoc.querySelector('pages');

  // 페이지 수 결정: count 속성 또는 page/page_item 요소 개수
  let numPages = 0;
  if (pages) {
    const countAttr = pages.getAttribute('count');
    if (countAttr) {
      numPages = parseInt(countAttr, 10);
    } else {
      // Simplified 형식: page 요소 개수로 계산
      const pageElements = pages.querySelectorAll('page');
      const pageItemElements = pages.querySelectorAll('page_item');
      numPages = Math.max(pageElements.length, pageItemElements.length);
    }
  }

  const ret: NprojJson = {
    book: {
      title,
      author,
      section,
      owner,
      book: bookNum,
      start_page: startPage,
      extra_info,
      kind,
      offset,
    },
    pdf: {
      filename,
      numPages,
    },
    pages: new Array(numPages),
    symbols: [],
    resources: {},
  };

  // Simplified 형식: segment에서 기본 crop_margin 읽기
  let defaultCropMargin = { left: 0, right: 0, top: 0, bottom: 0 };
  if (isSimplifiedFormat) {
    const segment = xmlDoc.querySelector('segment');
    if (segment) {
      defaultCropMargin = {
        left: parseFloat(getTextContent(segment, 'crop_margin_left') || '0'),
        right: parseFloat(getTextContent(segment, 'crop_margin_right') || '0'),
        top: parseFloat(getTextContent(segment, 'crop_margin_top') || '0'),
        bottom: parseFloat(getTextContent(segment, 'crop_margin_bottom') || '0'),
      };
    }
  }

  // 페이지 아이템 처리 (NeoStudio: page_item, Simplified: page)
  const page_items = pages ? pages.querySelectorAll('page_item') : [];
  const simple_pages = pages ? pages.querySelectorAll('page') : [];
  const pageElements = page_items.length > 0 ? page_items : simple_pages;

  pageElements.forEach((page) => {
    const pageNumber = parseInt(page.getAttribute('number') || '0', 10);
    // Simplified 형식에서는 number가 절대 페이지 번호일 수 있음 (예: 804, 805...)
    // NeoStudio 형식에서는 number가 0-based 델타임
    let pageDelta: number;
    if (isSimplifiedFormat && pageNumber >= startPage) {
      // 절대 페이지 번호 → 델타로 변환
      pageDelta = pageNumber - startPage;
    } else {
      pageDelta = pageNumber;
    }
    const sobp: IPageSOBP = { section, owner, book: bookNum, page: startPage + pageDelta };

    let surface_pu: { left: number; top: number; right: number; bottom: number };
    let crop_margin_pu: { left: number; right: number; top: number; bottom: number };

    if (isSimplifiedFormat) {
      // Simplified 형식: 자식 요소에서 값 읽기
      const x1 = parseFloat(getTextContent(page, 'x1') || '0');
      const y1 = parseFloat(getTextContent(page, 'y1') || '0');
      const x2 = parseFloat(getTextContent(page, 'x2') || '0');
      const y2 = parseFloat(getTextContent(page, 'y2') || '0');

      surface_pu = { left: x1, top: y1, right: x2, bottom: y2 };

      // Simplified 형식: page에 crop_margin이 없으면 segment의 기본값 사용
      const cropLeft = parseFloat(getTextContent(page, 'crop_margin_left') || String(defaultCropMargin.left));
      const cropRight = parseFloat(getTextContent(page, 'crop_margin_right') || String(defaultCropMargin.right));
      const cropTop = parseFloat(getTextContent(page, 'crop_margin_top') || String(defaultCropMargin.top));
      const cropBottom = parseFloat(getTextContent(page, 'crop_margin_bottom') || String(defaultCropMargin.bottom));

      crop_margin_pu = {
        left: cropLeft + offset.left,
        right: cropRight + offset.left,
        top: cropTop + offset.top,
        bottom: cropBottom + offset.top,
      };
    } else {
      // NeoStudio 형식: 속성에서 값 읽기
      surface_pu = {
        left: parseFloat(page.getAttribute('x1') || '0'),
        top: parseFloat(page.getAttribute('y1') || '0'),
        right: parseFloat(page.getAttribute('x2') || '0'),
        bottom: parseFloat(page.getAttribute('y2') || '0'),
      };

      const crop_margin_str = page.getAttribute('crop_margin') || '0,0,0,0';
      const margins = crop_margin_str.split(',');

      crop_margin_pu = {
        left: parseFloat(margins[0]) + offset.left,
        right: parseFloat(margins[1]) + offset.left,
        top: parseFloat(margins[2]) + offset.top,
        bottom: parseFloat(margins[3]) + offset.top,
      };
    }

    const size_pu = {
      width:
        Math.round(surface_pu.right - crop_margin_pu.right) -
        (surface_pu.left + crop_margin_pu.left) +
        offset.left,
      height:
        Math.round(surface_pu.bottom - crop_margin_pu.bottom) -
        (surface_pu.top + crop_margin_pu.top) +
        offset.top,
    };

    const nu = {
      Xmin: (surface_pu.left + crop_margin_pu.left) * PU_TO_NU,
      Ymin: (surface_pu.top + crop_margin_pu.top) * PU_TO_NU,
      Xmax: (surface_pu.left + size_pu.width) * PU_TO_NU,
      Ymax: (surface_pu.top + size_pu.height) * PU_TO_NU,
    };

    const item: NprojPageJson = {
      sobp,
      size_pu,
      nu,
      whole: {
        x1: surface_pu.left,
        x2: surface_pu.right,
        y1: surface_pu.top,
        y2: surface_pu.bottom,
      },
      crop_margin: crop_margin_pu,
    };

    ret.pages[pageDelta] = item;
  });

  // 심볼 정보 처리
  const symbols = xmlDoc.querySelector('symbols');
  const symbolElements = symbols ? symbols.querySelectorAll('symbol') : [];

  symbolElements.forEach((sym) => {
    const pageDelta = parseInt(sym.getAttribute('page') || '0', 10);
    const page = pageDelta + startPage;
    const sobp = { section, owner, book: bookNum, page };

    const type = (sym.getAttribute('type') || '') as PuiSymbolType['type'];
    const x = parseFloat(sym.getAttribute('x') || '0');
    const y = parseFloat(sym.getAttribute('y') || '0');
    const width = parseFloat(sym.getAttribute('width') || '0');
    const height = parseFloat(sym.getAttribute('height') || '0');
    const lock = parseInt(sym.getAttribute('lock') || '0', 10);

    const commandElement = sym.querySelector('command');
    let command: string = commandElement
      ? commandElement.getAttribute('param') || ''
      : '';

    const commandAction: string = commandElement
      ? commandElement.getAttribute('action') || ''
      : '';

    // Sound Play 처리
    if (commandAction === 'Play') {
      const langResources = sym.querySelector('language_resources');
      if (langResources) {
        let symbolId = getTextContent(sym, 'id');
        const uuidMatch = symbolId.match(/{(.*)}/);
        if (uuidMatch) {
          symbolId = uuidMatch[1];
        }
        const soundResource = langResources.querySelector(
          "language[resource_type='Sound']"
        );
        const soundResourceId: string = soundResource
          ? soundResource.getAttribute('resource_id') || ''
          : '';
        const soundId = `${symbolId}::${soundResourceId}`;
        command = command.length > 0 ? soundId + '!!' + command : soundId;
      }
    }

    // gif/pdf/video 링크 처리
    const commandName: string = commandElement
      ? commandElement.getAttribute('name') || ''
      : '';
    if (commandName === 'gif' || commandName === 'pdf' || commandName === 'video') {
      const isGoogleDrive = command.match(/^https:\/\/drive\.google\.com/);
      const isDropbox = command.match(/^.*https:\/\/www\.dropbox\.com/);
      if (isGoogleDrive !== null || isDropbox !== null) {
        command = commandName + '!!' + command;
      }
    }

    const extraElement = sym.querySelector('extra');
    const extra = extraElement ? extraElement.getAttribute('param') || '' : '';

    switch (type) {
      case 'Rectangle': {
        const puiSymbol: PuiSymbolType = {
          type,
          command,
          sobp,
          rect_nu: {
            left: x * PU_TO_NU - offset.left,
            top: y * PU_TO_NU - offset.top,
            width: width * PU_TO_NU,
            height: height * PU_TO_NU,
          },
          extra,
        };
        ret.symbols.push(puiSymbol);
        break;
      }

      case 'Ellipse': {
        const puiSymbol: PuiSymbolType = {
          type,
          command,
          sobp,
          ellipse_nu: {
            x: x * PU_TO_NU - offset.left,
            y: y * PU_TO_NU - offset.top,
            width: width * PU_TO_NU,
            height: height * PU_TO_NU,
          },
          extra,
        };
        ret.symbols.push(puiSymbol);
        break;
      }

      case 'Custom': {
        const puiSymbol: PuiSymbolType = {
          type,
          command,
          sobp,
          custom_nu: {
            left: x * PU_TO_NU - offset.left,
            top: y * PU_TO_NU - offset.top,
            width: width * PU_TO_NU,
            height: height * PU_TO_NU,
            lock: lock === 1,
          },
          extra,
        };
        ret.symbols.push(puiSymbol);
        break;
      }

      default:
        // Polygon 등 기타 타입은 무시
        console.warn(`Unsupported symbol type: ${type}`);
    }
  });

  // 리소스 정보 처리
  const resourcesElement = xmlDoc.querySelector('resources');
  const resourceElements = resourcesElement
    ? resourcesElement.querySelectorAll('resource')
    : [];

  resourceElements.forEach((res) => {
    const id = getTextContent(res, 'id');
    const path = getTextContent(res, 'path');
    if (id && path) {
      ret.resources[id] = path;
    }
  });

  return ret;
}

/**
 * NPROJ에서 시작/종료 SOBP 정보 추출
 */
export function getStartEndSobp(nprojStr: string): {
  startSobp: IPageSOBP;
  endSobp: IPageSOBP;
  nprojJson: NprojJson;
} {
  const nprojJson = nprojToJson(nprojStr);

  // 유효한 페이지가 있는지 확인
  const validPages = nprojJson.pages.filter((p) => p != null);
  if (validPages.length === 0) {
    throw new Error('No valid pages found in nproj');
  }

  const startSobp = validPages[0].sobp;
  const endSobp = validPages[validPages.length - 1].sobp;

  return { startSobp, endSobp, nprojJson };
}

/**
 * 특정 페이지의 크기 정보 조회
 * @param nprojJson NPROJ JSON
 * @param page 페이지 번호 (SOBP의 page)
 * @returns 페이지 크기 (PU 단위) 또는 null
 */
export function getPageSize(
  nprojJson: NprojJson,
  page: number
): { width: number; height: number } | null {
  const pageIndex = page - nprojJson.book.start_page;
  if (pageIndex < 0 || pageIndex >= nprojJson.pages.length) {
    return null;
  }

  const pageInfo = nprojJson.pages[pageIndex];
  if (!pageInfo) {
    return null;
  }

  return {
    width: pageInfo.size_pu.width,
    height: pageInfo.size_pu.height,
  };
}

/**
 * 페이지의 PDF 인덱스 계산
 * @param nprojJson NPROJ JSON
 * @param page 페이지 번호 (SOBP의 page)
 * @returns PDF 페이지 인덱스 (0-based) 또는 -1
 */
export function getPdfPageIndex(nprojJson: NprojJson, page: number): number {
  const pageIndex = page - nprojJson.book.start_page;
  if (pageIndex < 0 || pageIndex >= nprojJson.pages.length) {
    return -1;
  }
  return pageIndex;
}

/**
 * NPROJ 페이지 정보를 직접 가져오기
 */
export function getNprojPageInfo(
  nprojJson: NprojJson,
  page: number
): NprojPageJson | null {
  const pageIndex = page - nprojJson.book.start_page;
  if (pageIndex < 0 || pageIndex >= nprojJson.pages.length) {
    return null;
  }
  return nprojJson.pages[pageIndex] || null;
}
