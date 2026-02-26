import { NavLink } from 'react-router-dom';

export default function LNB() {
    const menuItems = [
        { path: '/host/dashboard', icon: '🏠', label: '홈' },
        { path: '/host/sessions', icon: '📋', label: '세션 목록' },
        { path: '/host/worksheets', icon: '📄', label: '내 워크시트' },
        { path: '/host/results', icon: '📊', label: '수업 결과' },
    ];

    return (
        <aside className="w-64 h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col shadow-2xl">
            {/* 로고 영역 */}
            <div className="p-6 border-b border-gray-700">
                <div className="flex items-center justify-center text-2xl font-black mb-1">
                    <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Neo</span>
                    <span className="text-white">CAST</span>
                </div>
                <p className="text-xs text-gray-400 text-center">Teacher Dashboard</p>
            </div>

            {/* 메뉴 영역 */}
            <nav className="flex-1 p-4 space-y-2">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                isActive
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg'
                                    : 'hover:bg-gray-700/50'
                            }`
                        }
                    >
                        <span className="text-2xl">{item.icon}</span>
                        <span className="font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* 하단 정보 */}
            <div className="p-4 border-t border-gray-700">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-700/30 rounded-xl">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-xl">
                        👩‍🏫
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                            {localStorage.getItem('nc_host_nickname') || '선생님'}
                        </p>
                        <p className="text-xs text-gray-400">Teacher</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
