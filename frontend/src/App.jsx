import { useState, useEffect } from 'react';
import api from './api';
import LoginView from './components/LoginView';
import SearchView from './components/SearchView';
import AutomationView from './components/AutomationView';
import ReportsView from './components/ReportsView';
import TendersView from './components/TendersView';
import ObservedView from './components/ObservedView';
import AnalyticsView from './components/AnalyticsView';
import EndpointsView from './components/EndpointsView';
import KeywordsView from './components/KeywordsView';
import SmtpView from './components/SmtpView';
import UsersView from './components/UsersView';
import NotificationsBell from './components/NotificationsBell';
import {
  Search,
  Clock,
  FileSpreadsheet,
  FileText,
  BookmarkCheck,
  BarChart3,
  Users,
  Globe,
  KeyRound,
  Mail,
  LogOut,
} from 'lucide-react';
import { getEffectiveUserRole, getRolePermissions } from './rolesStore';

export default function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');
    return token ? { token, username, role } : null;
  });

  const [checkingSession, setCheckingSession] = useState(() =>
    Boolean(localStorage.getItem('token'))
  );

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'search';
  });

  const [observedBadge, setObservedBadge] = useState({ observedCount: 0, unreadCount: 0 });
  const [, setTick] = useState(0);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem('activeTab', tabId);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    setAuth(null);
  };

  const fetchObservedBadge = async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const res = await api.get('/tenders/observed/badge');
      setObservedBadge({
        observedCount: res.data?.observedCount || 0,
        unreadCount: res.data?.unreadCount || 0,
      });
    } catch {
      // Ciche pominięcie
    }
  };

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    const handleForceLogout = () => setAuth(null);
    const handleObservedUpdated = () => fetchObservedBadge();

    window.addEventListener('rolesUpdated', handleUpdate);
    window.addEventListener('authForceLogout', handleForceLogout);
    window.addEventListener('observedUpdated', handleObservedUpdated);
    return () => {
      window.removeEventListener('rolesUpdated', handleUpdate);
      window.removeEventListener('authForceLogout', handleForceLogout);
      window.removeEventListener('observedUpdated', handleObservedUpdated);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setCheckingSession(false);
      return;
    }
    api
      .get('/search/sources')
      .then(() => {
        setCheckingSession(false);
        fetchObservedBadge();
      })
      .catch(() => {
        handleLogout();
        setCheckingSession(false);
      });
  }, []);

  useEffect(() => {
    if (!auth) return;
    fetchObservedBadge();
    const interval = setInterval(fetchObservedBadge, 10000);
    return () => clearInterval(interval);
  }, [auth]);

  if (checkingSession) {
    return null;
  }

  if (!auth) {
    return <LoginView onLoginSuccess={(data) => setAuth(data)} />;
  }

  const effectiveRole = getEffectiveUserRole(auth.username, auth.role);
  const permissions = getRolePermissions(effectiveRole);

  // Zakładki dostępne dla każdego (Obserwowane bezpośrednio pod Przetargami)
  const alwaysAvailableItems = [
    { id: 'search', label: 'Wyszukiwarka', icon: Search },
    { id: 'automation', label: 'Automatyzacja', icon: Clock },
    { id: 'reports', label: 'Raporty', icon: FileSpreadsheet },
    { id: 'tenders', label: 'Przetargi', icon: FileText },
    { id: 'observed', label: 'Obserwowane', icon: BookmarkCheck },
    { id: 'analytics', label: 'Statystyki', icon: BarChart3 },
  ];

  const rolePanelItems = [
    { id: 'endpoints', label: 'Endpointy', icon: Globe, perm: 'ENDPOINTS' },
    { id: 'keywords', label: 'Keywordsy', icon: KeyRound, perm: 'KEYWORDS' },
    { id: 'smtp', label: 'SMTP', icon: Mail, perm: 'SMTP' },
    { id: 'users', label: 'Użytkownicy', icon: Users, perm: 'USERS' },
  ].filter((item) => permissions.includes(item.perm));

  return (
    <div className="min-h-screen flex bg-slate-50 text-black">
      <aside className="w-64 bg-white border-r-2 border-blue-600 flex flex-col justify-between shrink-0">
        <div>
          <div className="p-6 border-b border-blue-100">
            <h1 className="text-xl font-extrabold text-black tracking-tight">
              System Przetargów
            </h1>
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <p className="text-xs font-semibold text-black truncate">
                Zalogowany: <span className="underline">{auth.username}</span>
              </p>
              <NotificationsBell />
            </div>
          </div>

          <nav className="p-4 space-y-2">
            {alwaysAvailableItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isObservedTab = item.id === 'observed';

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl font-bold text-sm transition cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-black hover:bg-blue-50'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon size={18} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>

                  {isObservedTab && observedBadge.unreadCount > 0 && (
                    <span
                      title={`Nowe aktualizacje: ${observedBadge.unreadCount}`}
                      className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-red-600 text-white shrink-0"
                    >
                      {observedBadge.unreadCount}
                    </span>
                  )}

                  {isObservedTab &&
                    observedBadge.unreadCount === 0 &&
                    observedBadge.observedCount > 0 && (
                      <span
                        title={`Obserwowane przetargi: ${observedBadge.observedCount}`}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold shrink-0 ${
                          isActive
                            ? 'bg-white/25 text-white'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {observedBadge.observedCount}
                      </span>
                    )}
                </button>
              );
            })}

            {rolePanelItems.length > 0 && (
              <div className="pt-4 mt-4 border-t-2 border-blue-100 space-y-2">
                <div className="px-4 py-1 text-xs font-extrabold uppercase tracking-wider text-blue-700">
                  Panel Roli: {effectiveRole.replace(/^ROLE_/, '')}
                </div>
                {rolePanelItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white text-black hover:bg-blue-50'
                      }`}
                    >
                      <Icon size={18} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        <div className="p-4 border-t border-blue-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-sm text-black hover:bg-blue-50 border border-blue-200 cursor-pointer"
          >
            <LogOut size={18} />
            Wyloguj się
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'search' && <SearchView />}
        {activeTab === 'automation' && <AutomationView />}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'tenders' && <TendersView />}
        {activeTab === 'observed' && <ObservedView />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'endpoints' && permissions.includes('ENDPOINTS') && <EndpointsView />}
        {activeTab === 'keywords' && permissions.includes('KEYWORDS') && <KeywordsView />}
        {activeTab === 'smtp' && permissions.includes('SMTP') && <SmtpView />}
        {activeTab === 'users' && permissions.includes('USERS') && <UsersView />}
      </main>
    </div>
  );
}