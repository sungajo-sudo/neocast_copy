import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Archive,
  LogOut,
  Menu,
  X,
  UserCheck,
  FileCode,
  MessageSquare,
  HardDrive,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../store/auth';

interface NavItem {
  path: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    path: '/dashboard',
    icon: LayoutDashboard,
    label: '대시보드',
    children: [
      { path: '/dashboard/users', icon: UserCheck, label: '이용자 통계' },
      { path: '/dashboard/ncode', icon: FileCode, label: 'NCode 통계' },
      { path: '/dashboard/chat', icon: MessageSquare, label: '채팅/메신저' },
      { path: '/dashboard/storage', icon: HardDrive, label: '스토리지' },
    ],
  },
  { path: '/sessions', icon: Users, label: '활성 세션' },
  { path: '/archives', icon: Archive, label: '아카이브' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['/dashboard']);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleMenu = (path: string) => {
    setExpandedMenus((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const isMenuExpanded = (path: string) => expandedMenus.includes(path);
  const isPathActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return 'U';
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return names[0][0] + names[1][0];
    }
    return names[0].substring(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar for mobile */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-card border-b border-border md:hidden flex items-center justify-between px-4">
        <button
          className="p-2 rounded-md hover:bg-accent"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <span className="font-semibold text-primary">NeoCAST Admin</span>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium"
            title={user?.name || 'User'}
          >
            {getUserInitials()}
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed top-14 md:top-0 bottom-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo - desktop only */}
          <div className="hidden md:flex p-6 border-b border-border items-center justify-between">
            <h1 className="text-xl font-bold text-primary">NeoCAST Admin</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) =>
              item.children ? (
                <div key={item.path}>
                  {/* Parent menu with toggle */}
                  <button
                    onClick={() => toggleMenu(item.path)}
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-colors ${
                      isPathActive(item.path)
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={20} />
                      <span>{item.label}</span>
                    </div>
                    {isMenuExpanded(item.path) ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>
                  {/* Child items */}
                  {isMenuExpanded(item.path) && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                              isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            }`
                          }
                        >
                          <child.icon size={16} />
                          <span>{child.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`
                  }
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </NavLink>
              )
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut size={20} />
              <span>로그아웃</span>
            </button>
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="truncate">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="로그아웃"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="md:pl-64 pt-14 md:pt-0">
        <div className="p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
