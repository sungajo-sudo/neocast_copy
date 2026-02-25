import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';

interface NavItem {
  to: string;
  end?: boolean;
  label: string;
  icon: React.ReactNode;
}

const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const SessionListIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const WorksheetIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const ResultIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { to: '/host', end: true, label: '홈', icon: <HomeIcon /> },
  { to: '/host/sessions', label: '세션 목록', icon: <SessionListIcon /> },
  { to: '/host/worksheets', label: '내 워크시트', icon: <WorksheetIcon /> },
  { to: '/host/results', label: '수업 결과', icon: <ResultIcon /> },
];

/**
 * 호스트 전용 레이아웃
 * 좌측 LNB + 우측 콘텐츠 영역
 */
export function HostLayout() {
  const { user } = useAuthStore();

  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : 'HC';

  return (
    <div className="flex h-full overflow-hidden">
      {/* ─── 좌측 LNB ─── */}
      <nav className="w-56 flex-shrink-0 flex flex-col bg-white border-r border-gray-200 overflow-y-auto">

        {/* 네비게이션 메뉴 */}
        <div className="flex-1 py-4 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>
                    {item.icon}
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* ─── 하단 프로필 영역 ─── */}
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name ?? '사용자'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email ?? ''}</p>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── 우측 콘텐츠 영역 ─── */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
