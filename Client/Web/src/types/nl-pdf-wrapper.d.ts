/**
 * Type declarations for nl-pdf-wrapper (wasm-pdf-core)
 * This module is aliased via vite.config.ts to sub-modules/wasm-pdf-core
 */

declare module 'nl-pdf-wrapper' {
  export interface PDFWorkerEmployerOptions {
    useWorker: boolean;
  }

  export interface PDFWorkerEmployer {
    initWorker(): Promise<void>;
    terminate(): void;
  }

  export interface NcodeFontOptions {
    glyphDiameter: number;
  }

  export interface NcodeFont {
    // Opaque font object
  }

  export interface OpenFromBufferOptions {
    paperGroupId: string;
    buffer: ArrayBuffer;
    docName: string;
  }

  export interface AddNcodeLayerOptions {
    sobp: string;
    isPdfInRGB: boolean;
    ncodeFont: NcodeFont;
  }

  export class NeoPDFContext {
    constructor(employer: PDFWorkerEmployer);
    initContext(employer: PDFWorkerEmployer, poolSize: number): Promise<void>;
    free(): void;
  }

  export class NeoPDFPage {
    convertPageColor(
      toRgb: boolean,
      toCmy: boolean,
      ncodeFont: NcodeFont | null,
      useRgbPseudoColor: boolean,
      maxBlueContrast: number,
      shouldFlatten: boolean,
      dropContents: boolean,
      rgbSoftMark: boolean
    ): Promise<void>;
    startNcodeLayersOverlay(): void;
    addNcodeLayer(options: AddNcodeLayerOptions): Promise<void>;
    flushAndDrawNcodeLayers(): Promise<void>;
    flattenPage(): Promise<void>;
    free(): Promise<void>;
  }

  export class NeoPDFDocument {
    constructor(employer: PDFWorkerEmployer, context: NeoPDFContext);
    openFromBuffer(options: OpenFromBufferOptions): Promise<void>;
    prepareNcodeFont(options: NcodeFontOptions): Promise<NcodeFont>;
    getPage(pageIndex: number): Promise<NeoPDFPage | null>;
    saveBytes(): Promise<Uint8Array>;
    free(): Promise<void>;
  }

  export function createPDFWorkerEmployer(options: PDFWorkerEmployerOptions): PDFWorkerEmployer;
  export function setUsePdfWorkers(useWorkers: boolean): void;
}
