/**
 * wasm-pdf-core stub
 * 로컬 개발 환경에서 private 서브모듈 대신 사용하는 스텁.
 * NCode PDF 생성 기능은 동작하지 않지만 앱 실행은 가능.
 */
export function createPDFWorkerEmployer() {
  console.warn('[wasm-pdf-core stub] createPDFWorkerEmployer called — stub only');
  return null;
}

export class NeoPDFContext {}
export class NeoPDFDocument {}

export function setUsePdfWorkers() {
  console.warn('[wasm-pdf-core stub] setUsePdfWorkers called — stub only');
}

export default {};
