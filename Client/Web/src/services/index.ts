export { strokeService } from './stroke-service';
export { authService } from './auth-service';
export { neosmartpenService } from './neosmartpen.service';
export { webBluetoothService } from './web-bluetooth.service';
export { penInputService } from './pen-input.service';
export * from './pen-protocol';
export { localPaperHubService } from './local-paperhub.service';
export { ncPaperHubClientService } from './nc-paperhub-client.service';
export type { LocalPaper, NcodePdfCompound, SavePaperRequest } from './local-paperhub.service';
export type { AllocateResult, AttachResult, PaperInfo } from './nc-paperhub-client.service';
export {
  generateNproj,
  generateNprojFromPdf,
  getPdfPageCount,
  getPdfPageSize,
  analyzePdfFile,
} from './nproj-generator.service';
export type { NCodeInfo, PageSize } from './nproj-generator.service';
export { fileUploadService } from './file-upload.service';
export type { UploadResult, FileMetadata, UploadProgress, ProgressCallback } from './file-upload.service';
export {
  generateNcodePdf,
  createPagesFromNcode,
  downloadPdf,
  printPdf,
} from './ncode-pdf-generator.service';
export type {
  NcodePageInfo,
  NcodePdfGeneratorOptions,
  NcodePdfGeneratorResult,
} from './ncode-pdf-generator.service';
