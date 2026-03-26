/**
 * 게스트 화면 상단 첨삭 알림 배너
 * 호스트가 첨삭 중일 때 표시됨
 */

export function AnnotationBanner() {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 flex-shrink-0 animate-in">
      <span className="relative flex w-2 h-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
      <span className="text-sm font-semibold text-red-600">
        선생님이 첨삭 중입니다
      </span>
    </div>
  );
}
