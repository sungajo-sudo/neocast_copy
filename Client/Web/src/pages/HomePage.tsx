import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAnalysisCache } from '../utils/analysisCache';
import { sessionService } from '../services/session-service';
import { useAuthStore } from '../stores/auth-store';
import { useSessionStore } from '../stores/session-store';
import { useConnectionStore } from '../stores/connection-store';

interface EndedSession {
  sessionId: string;
  title: string;
  sessionCode?: string;
  participantCount: number;
  endedAt: string;
}

interface ArchiveItem {
  archiveId: string;
  sessionName: string;
  participantCount: number;
  endedAt: string;
  pages: number;
}

const DUMMY_ENDED_SESSIONS: EndedSession[] = [
  {
    sessionId: 'test-001',
    title: '수학 월요일 오전반',
    participantCount: 3,
    endedAt: '2026-03-23T10:30:00',
  },
  {
    sessionId: 'test-002',
    title: '영어 화요일 저녁반',
    participantCount: 3,
    endedAt: '2026-03-22T18:00:00',
  },
  {
    sessionId: 'test-003',
    title: '국어 수요일 오후반',
    participantCount: 3,
    endedAt: '2026-03-21T14:00:00',
  },
];

const DUMMY_ARCHIVES: ArchiveItem[] = [
  {
    archiveId: 'archive_003',
    sessionName: '이차방정식 문제풀이',
    participantCount: 5,
    endedAt: '2026-03-21T16:30:00',
    pages: 7,
  },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function HomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [nickname, setNickname] = useState('선생님');
  const [endedSessions, setEndedSessions] = useState<EndedSession[]>([]);
  const [archives, setArchives] = useState<ArchiveItem[]>([]);

  // 재접속 가능한 세션
  const [reconnectableSession, setReconnectableSession] = useState<{
    sessionId: string;
    sessionCode: string;
    title?: string;
    participantCount: number;
  } | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  // 세션 종료 확인 팝업
  const [endSessionPopup, setEndSessionPopup] = useState(false);

  // 아카이브 저장 팝업 상태
  const [savePopup, setSavePopup] = useState<{ open: boolean; session: EndedSession | null; saving: boolean; done: boolean }>({ open: false, session: null, saving: false, done: false });
  // 삭제 확인 팝업 상태
  const [deletePopup, setDeletePopup] = useState<{ open: boolean; sessionId: string | null }>({ open: false, sessionId: null });

  // 재접속 가능한 세션 조회
  useEffect(() => {
    const tokens = useAuthStore.getState().tokens;

    // TODO: 더미 데이터 — 서버 연동 시 아래 블록을 제거하고 API 호출로 교체
    if (!tokens?.accessToken) {
      setReconnectableSession({
        sessionId: 'dummy-reconnect-001',
        sessionCode: 'ABC123',
        title: '수학 월요일 오전반',
        participantCount: 3,
      });
      return;
    }

    sessionService.getReconnectableSession(tokens.accessToken)
      .then((res) => {
        if (res.hasDisconnectedSession && res.session) {
          setReconnectableSession({
            sessionId: res.session.sessionId,
            sessionCode: res.session.sessionCode,
            participantCount: res.session.participantCount,
          });
        }
      })
      .catch(() => {
        // API 실패 시 더미로 폴백 (개발용)
        setReconnectableSession({
          sessionId: 'dummy-reconnect-001',
          sessionCode: 'ABC123',
          title: '수학 월요일 오전반',
          participantCount: 3,
        });
      });
  }, []);

  // 다시 접속 핸들러
  const handleReconnect = useCallback(async () => {
    if (!reconnectableSession) return;
    const tokens = useAuthStore.getState().tokens;
    if (!tokens?.accessToken) return;

    setReconnecting(true);
    try {
      const res = await sessionService.reconnectToSession(tokens.accessToken, reconnectableSession.sessionId);

      // WebSocket 연결 (control, chat, voice, stroke)
      const serverUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/api$/, '').replace(/\/$/, '') || window.location.origin;
      await useConnectionStore.getState().connect(serverUrl, tokens.accessToken, res.session.id);

      // 세션 스토어 업데이트
      const sessionStore = useSessionStore.getState();
      sessionStore.setCurrentUserId(useAuthStore.getState().user?.id ?? '');
      sessionStore.setSession({
        id: res.session.id,
        code: res.session.code,
        title: res.session.title,
        status: res.session.status as 'active' | 'paused' | 'closed',
        hostId: res.session.hostId,
        participants: res.session.participants?.map(p => ({
          userId: p.userId,
          userName: p.userName,
          role: p.role as 'host' | 'guest',
          joinedAt: new Date(p.joinedAt).getTime(),
          isMuted: false,
          isSpeaking: false,
          isOnline: true,
        })) ?? [],
        createdAt: new Date(res.session.createdAt).getTime(),
      });

      navigate(`/session/${res.session.code}`, { state: { justJoined: true } });
    } catch {
      setReconnecting(false);
    }
  }, [reconnectableSession, navigate]);

  // 세션 종료 핸들러
  const handleEndReconnectable = useCallback(async () => {
    if (!reconnectableSession) return;
    const tokens = useAuthStore.getState().tokens;
    if (!tokens?.accessToken) return;

    try {
      await sessionService.closeSession(tokens.accessToken, reconnectableSession.sessionId);
      setReconnectableSession(null);
    } catch {
      // 실패 시 무시
    }
    setEndSessionPopup(false);
  }, [reconnectableSession]);

  useEffect(() => {
    // 인증 정보 로드
    try {
      const auth = JSON.parse(localStorage.getItem('nc_auth') || '{}');
      if (auth.nickname) setNickname(auth.nickname);
    } catch {}

    // 종료 세션은 매번 더미로 리셋
    localStorage.setItem('nc_ended_sessions', JSON.stringify(DUMMY_ENDED_SESSIONS));
    setEndedSessions(DUMMY_ENDED_SESSIONS);

    // 아카이브는 저장된 것 유지 + 더미 병합
    try {
      const saved = localStorage.getItem('nc_archives');
      if (saved) {
        const existing = JSON.parse(saved) as ArchiveItem[];
        // 더미가 없으면 추가, 사용자가 저장한 것도 유지
        const dummyIds = DUMMY_ARCHIVES.map(d => d.archiveId);
        const userAdded = existing.filter(e => !dummyIds.includes(e.archiveId));
        const finalArchives = [...DUMMY_ARCHIVES, ...userAdded];
        localStorage.setItem('nc_archives', JSON.stringify(finalArchives));
        setArchives(finalArchives);
      } else {
        localStorage.setItem('nc_archives', JSON.stringify(DUMMY_ARCHIVES));
        setArchives(DUMMY_ARCHIVES);
      }
    } catch {
      setArchives(DUMMY_ARCHIVES);
    }
  }, []);

  // 종료된 세션 → 아카이브 저장 팝업 열기
  const handleSaveToArchive = (session: EndedSession) => {
    setSavePopup({ open: true, session, saving: false, done: false });
  };

  // 팝업에서 "확인" 클릭 → 로딩 → 저장 완료
  const confirmSaveArchive = useCallback(() => {
    if (!savePopup.session) return;
    const session = savePopup.session;
    setSavePopup(prev => ({ ...prev, saving: true }));

    // 로딩 시뮬레이션 (1.5초)
    setTimeout(() => {
      const newArchive: ArchiveItem = {
        archiveId: `archive_${session.sessionId}`,
        sessionName: session.title,
        participantCount: session.participantCount,
        endedAt: session.endedAt,
        pages: 5,
      };

      setArchives(prev => {
        const updated = [newArchive, ...prev];
        localStorage.setItem('nc_archives', JSON.stringify(updated));
        return updated;
      });

      setEndedSessions(prev => {
        const updated = prev.filter(s => s.sessionId !== session.sessionId);
        localStorage.setItem('nc_ended_sessions', JSON.stringify(updated));
        return updated;
      });

      setSavePopup(prev => ({ ...prev, saving: false, done: true }));

      // 1초 후 팝업 닫기
      setTimeout(() => {
        setSavePopup({ open: false, session: null, saving: false, done: false });
      }, 1000);
    }, 1500);
  }, [savePopup.session]);

  // 종료된 세션 삭제 팝업 열기
  const handleDismissEnded = (sessionId: string) => {
    setDeletePopup({ open: true, sessionId });
  };

  // 삭제 확인
  const confirmDelete = () => {
    if (!deletePopup.sessionId) return;
    setEndedSessions(prev => {
      const updated = prev.filter(s => s.sessionId !== deletePopup.sessionId);
      localStorage.setItem('nc_ended_sessions', JSON.stringify(updated));
      return updated;
    });
    setDeletePopup({ open: false, sessionId: null });
  };

  return (
    <div className="min-h-screen relative bg-app-bg">
      {/* 본문 */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 flex flex-col gap-10">
        {/* 인사말 */}
        <h1 className="text-2xl font-extrabold text-gray-800">
          {t('homePage.greeting', { name: nickname })}
        </h1>

        {/* ── 진행 중인 세션 재접속 배너 ── */}
        {reconnectableSession && (
          <div className="neo-card border-2 border-orange-300 bg-orange-50/60 p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="w-3 h-3 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-bold text-gray-800 text-sm">
                  {t('homePage.reconnectTitle')}
                </span>
                <span className="text-xs text-gray-500 truncate">
                  {reconnectableSession.title ?? reconnectableSession.sessionCode}
                  {' · '}
                  {t('homePage.participantCount', { count: reconnectableSession.participantCount })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 active:scale-[0.97] transition-all disabled:opacity-60"
              >
                {reconnecting ? t('homePage.reconnecting') : t('homePage.reconnectButton')}
              </button>
              <button
                onClick={() => setEndSessionPopup(true)}
                disabled={reconnecting}
                className="px-3 py-2 rounded-xl bg-gray-100 text-gray-500 text-xs font-medium hover:bg-gray-200 hover:text-gray-700 active:scale-[0.97] transition-all disabled:opacity-60"
              >
                {t('homePage.reconnectEnd')}
              </button>
            </div>
          </div>
        )}

        {/* 새 세션 시작 카드 */}
        <button
          onClick={() => navigate('/session/create')}
          className="w-full neo-card p-6 flex items-center gap-4 hover:shadow-lg active:scale-[0.99] transition-all text-left group"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white flex-shrink-0 group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-gray-800 text-base">{t('homePage.newSession')}</p>
            <p className="text-sm text-gray-500 mt-0.5">{t('homePage.newSessionDesc')}</p>
          </div>
        </button>

        {/* 종료된 세션 (아카이브 저장 대기) — 없으면 영역 숨김 */}
        {endedSessions.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-gray-700">{t('homePage.endedSessions')}</h2>
            <div className="flex flex-col gap-2">
              {endedSessions.map((session) => (
                <div
                  key={session.sessionId}
                  className="neo-card px-6 py-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium text-gray-800 text-sm truncate">
                        {session.title}
                      </span>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{t('homePage.participantCount', { count: session.participantCount })}</span>
                        <span>{formatDateTime(session.endedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <button
                      onClick={() => handleSaveToArchive(session)}
                      className="px-3 py-1.5 rounded-lg bg-brand-tint text-brand-primary text-xs font-medium hover:bg-brand-tint2 transition-colors"
                    >
                      {t('homePage.saveToArchive')}
                    </button>
                    <button
                      onClick={() => handleDismissEnded(session.sessionId)}
                      className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-400 text-xs font-medium hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                      {t('homePage.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 아카이브 목록 */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-gray-700">{t('homePage.archives')}</h2>

          {archives.length === 0 ? (
            <div className="neo-card p-10 text-center flex flex-col items-center gap-2">
              <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              <p className="text-gray-400 text-sm">{t('homePage.noArchives')}</p>
              <p className="text-gray-300 text-xs">{t('homePage.noArchivesHint')}</p>
            </div>
          ) : (
            <div className="neo-card overflow-hidden">
              {archives.map((item, idx) => (
                <button
                  key={item.archiveId}
                  onClick={() => navigate(`/archive/${item.archiveId}`)}
                  className={`group/row w-full flex items-center justify-between px-6 py-4 hover:bg-brand-tint/60 transition-all duration-200 text-left ${
                    idx !== archives.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 text-sm">{item.sessionName}</span>
                      {getAnalysisCache(item.archiveId)?.sessionResult && (
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">AI 분석</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(item.endedAt)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">{item.participantCount}명</span>
                    <svg className="w-4 h-4 text-gray-400 group-hover/row:text-brand-primary group-hover/row:translate-x-0.5 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 아카이브 저장 팝업 ── */}
      {savePopup.open && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => !savePopup.saving && setSavePopup({ open: false, session: null, saving: false, done: false })}>
          <div className="bg-white rounded-2xl w-[90vw] max-w-[360px] p-6 shadow-2xl animate-in" onClick={e => e.stopPropagation()}>
            {savePopup.done ? (
              /* 완료 상태 */
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-gray-900">{t('homePage.saveDone')}</p>
                <p className="text-xs text-gray-400">{t('homePage.saveDoneDesc')}</p>
              </div>
            ) : savePopup.saving ? (
              /* 로딩 상태 */
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="relative">
                  <div className="w-10 h-10 border-[3px] border-gray-200 rounded-full" />
                  <div className="absolute inset-0 w-10 h-10 border-[3px] border-transparent border-t-brand-primary rounded-full animate-spin" />
                </div>
                <p className="text-sm font-semibold text-gray-600">{t('homePage.saving')}</p>
              </div>
            ) : (
              /* 확인 상태 */
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-tint flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{t('homePage.saveArchiveTitle')}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{savePopup.session?.title}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-5">
                  {t('homePage.saveArchiveConfirm')}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSavePopup({ open: false, session: null, saving: false, done: false })}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 active:scale-[0.97] transition-all"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={confirmSaveArchive}
                    className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-brand-primary rounded-xl hover:bg-brand-primary/90 active:scale-[0.97] transition-all"
                  >
                    {t('common.confirm')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 세션 종료 확인 팝업 ── */}
      {endSessionPopup && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setEndSessionPopup(false)}>
          <div className="bg-white rounded-2xl w-[90vw] max-w-[360px] p-6 shadow-2xl animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{t('homePage.reconnectEndTitle')}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {reconnectableSession?.title ?? reconnectableSession?.sessionCode}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              {t('homePage.reconnectEndConfirm')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setEndSessionPopup(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 active:scale-[0.97] transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleEndReconnectable}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-orange-500 rounded-xl hover:bg-orange-600 active:scale-[0.97] transition-all"
              >
                {t('homePage.reconnectEnd')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 팝업 ── */}
      {deletePopup.open && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setDeletePopup({ open: false, sessionId: null })}>
          <div className="bg-white rounded-2xl w-[90vw] max-w-[360px] p-6 shadow-2xl animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{t('homePage.deleteSessionTitle')}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {endedSessions.find(s => s.sessionId === deletePopup.sessionId)?.title}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              {t('homePage.deleteSessionConfirm')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletePopup({ open: false, sessionId: null })}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 active:scale-[0.97] transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 active:scale-[0.97] transition-all"
              >
                {t('homePage.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
