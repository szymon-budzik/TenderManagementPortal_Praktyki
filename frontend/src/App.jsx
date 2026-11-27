import { useState, useEffect } from 'react';
import api from './api';
import LoginView from './components/LoginView';
import SearchView from './components/SearchView';
import AutomationView from './components/AutomationView';
import ReportsView from './components/ReportsView';
import TendersView from './components/TendersView';
import ObservedView from './components/ObservedView';
import SharedInboxView from './components/SharedInboxView';
import AnalyticsView from './components/AnalyticsView';
import EndpointsView from './components/EndpointsView';
import KeywordsView from './components/KeywordsView';
import SmtpView from './components/SmtpView';
import AiConfigView from './components/AiConfigView';
import GroupsView from './components/GroupsView';
import UsersView from './components/UsersView';
import NotificationsBell from './components/NotificationsBell';
import ThemeToggleButton from './components/ThemeToggleButton';
import ConfigBackupModal from './components/ConfigBackupModal';
import { useTheme } from './hooks/useTheme';
import {
  Search,
  Clock,
  FileSpreadsheet,
  FileText,
  BookmarkCheck,
  Inbox,
  BarChart3,
  Users,
  Globe,
  KeyRound,
  Mail,
  Bot,
  Building2,
  LogOut,
  Database,
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
  const [sharedBadge, setSharedBadge] = useState({ totalCount: 0, unreadCount: 0 });
  const [reportsBadge, setReportsBadge] = useState({ totalCount: 0, unreadCount: 0 });
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [viewRefreshKey, setViewRefreshKey] = useState(0);
  const [, setTick] = useState(0);
  const { isDark, toggleTheme } = useTheme();

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem('activeTab', tabId);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('activeTab');
    setActiveTab('search');
    setObservedBadge({ observedCount: 0, unreadCount: 0 });
    setSharedBadge({ totalCount: 0, unreadCount: 0 });
    setReportsBadge({ totalCount: 0, unreadCount: 0 });
    setBackupModalOpen(false);
    setAuth(null);
  };

  const handleLoginSuccess = (data) => {
    localStorage.removeItem('activeTab');
    setActiveTab('search');
    setObservedBadge({ observedCount: 0, unreadCount: 0 });
    setSharedBadge({ totalCount: 0, unreadCount: 0 });
    setReportsBadge({ totalCount: 0, unreadCount: 0 });
    setViewRefreshKey((k) => k + 1);
    setAuth(data);
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

  const fetchSharedBadge = async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const res = await api.get('/shares/tenders/badge');
      setSharedBadge({
        totalCount: res.data?.totalCount || 0,
        unreadCount: res.data?.unreadCount || 0,
      });
    } catch {
      // Ciche pominięcie
    }
  };

  const fetchReportsBadge = async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const res = await api.get('/automation/runs/badge');
      setReportsBadge({
        totalCount: res.data?.totalCount || 0,
        unreadCount: res.data?.unreadCount || 0,
      });
    } catch {
      // Ciche pominięcie
    }
  };

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    const handleForceLogout = () => {
      localStorage.removeItem('activeTab');
      setActiveTab('search');
      setObservedBadge({ observedCount: 0, unreadCount: 0 });
      setSharedBadge({ totalCount: 0, unreadCount: 0 });
      setReportsBadge({ totalCount: 0, unreadCount: 0 });
      setBackupModalOpen(false);
      setAuth(null);
    };
    const handleObservedUpdated = () => fetchObservedBadge();
    const handleSharedUpdated = () => fetchSharedBadge();
    const handleReportsUpdated = () => fetchReportsBadge();

    window.addEventListener('rolesUpdated', handleUpdate);
    window.addEventListener('authForceLogout', handleForceLogout);
    window.addEventListener('authInvalid', handleForceLogout);
    window.addEventListener('observedUpdated', handleObservedUpdated);
    window.addEventListener('sharedUpdated', handleSharedUpdated);
    window.addEventListener('reportsUpdated', handleReportsUpdated);
    return () => {
      window.removeEventListener('rolesUpdated', handleUpdate);
      window.removeEventListener('authForceLogout', handleForceLogout);
      window.removeEventListener('authInvalid', handleForceLogout);
      window.removeEventListener('observedUpdated', handleObservedUpdated);
      window.removeEventListener('sharedUpdated', handleSharedUpdated);
      window.removeEventListener('reportsUpdated', handleReportsUpdated);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }
    api
      .get('/search/sources')
      .then(() => {
        setCheckingSession(false);
        fetchObservedBadge();
        fetchSharedBadge();
        fetchReportsBadge();
      })
      .catch(() => {
        handleLogout();
        setCheckingSession(false);
      });
  }, []);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    const refreshBadges = async () => {
      if (!localStorage.getItem('token')) return;
      try {
        const [obsRes, sharedRes, reportsRes] = await Promise.all([
          api.get('/tenders/observed/badge').catch(() => null),
          api.get('/shares/tenders/badge').catch(() => null),
          api.get('/automation/runs/badge').catch(() => null),
        ]);
        if (cancelled) return;
        if (obsRes) {
          setObservedBadge({
            observedCount: obsRes.data?.observedCount || 0,
            unreadCount: obsRes.data?.unreadCount || 0,
          });
        }
        if (sharedRes) {
          setSharedBadge({
            totalCount: sharedRes.data?.totalCount || 0,
            unreadCount: sharedRes.data?.unreadCount || 0,
          });
        }
        if (reportsRes) {
          setReportsBadge({
            totalCount: reportsRes.data?.totalCount || 0,
            unreadCount: reportsRes.data?.unreadCount || 0,
          });
        }
      } catch {
        // Ciche pominięcie
      }
    };
    refreshBadges();
    const interval = setInterval(refreshBadges, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [auth]);

  if (checkingSession) {
    return null;
  }

  if (!auth) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const effectiveRole = getEffectiveUserRole(auth.username, auth.role);
  const permissions = getRolePermissions(effectiveRole);
  const isAdmin = effectiveRole === 'ROLE_ADMIN';

  const alwaysAvailableItems = [
    { id: 'search', label: 'Wyszukiwarka', icon: Search },
    { id: 'automation', label: 'Automatyzacja', icon: Clock },
    { id: 'tenders', label: 'Przetargi', icon: FileText },
    { id: 'reports', label: 'Raporty', icon: FileSpreadsheet },
    { id: 'observed', label: 'Obserwowane', icon: BookmarkCheck },
    { id: 'shared', label: 'Przesłane', icon: Inbox },
    { id: 'analytics', label: 'Statystyki', icon: BarChart3 },
  ];

  const rolePanelItems = [
    { id: 'endpoints', label: 'Endpointy', icon: Globe, perm: 'ENDPOINTS' },
    { id: 'keywords', label: 'Keywordsy', icon: KeyRound, perm: 'KEYWORDS' },
    { id: 'smtp', label: 'SMTP', icon: Mail, perm: 'SMTP' },
    { id: 'ai', label: 'Integracje AI', icon: Bot, perm: 'ai' },
    { id: 'groups', label: 'Grupy', icon: Building2, perm: 'groups' },
    { id: 'users', label: 'Użytkownicy', icon: Users, perm: 'USERS' },
  ].filter((item) => permissions.includes(item.perm));

  return (
    <div className="min-h-screen flex bg-slate-50 text-black">
      {isAdmin && backupModalOpen && (
        <ConfigBackupModal
          onClose={() => setBackupModalOpen(false)}
          onImported={() => {
            setViewRefreshKey((k) => k + 1);
            fetchObservedBadge();
          }}
        />
      )}

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
              <div className="flex items-center gap-1.5 shrink-0">
                <ThemeToggleButton isDark={isDark} onToggle={toggleTheme} />
                <NotificationsBell key={auth.username} onNavigateTab={handleSelectTab} />
              </div>
            </div>
          </div>

          <nav className="p-4 space-y-2">
            {alwaysAvailableItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isReportsTab = item.id === 'reports';
              const isObservedTab = item.id === 'observed';
              const isSharedTab = item.id === 'shared';

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

                  {isReportsTab && reportsBadge.unreadCount > 0 && (
                    <span
                      title={`Nowe raporty: ${reportsBadge.unreadCount}`}
                      className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-red-600 text-white shrink-0"
                    >
                      {reportsBadge.unreadCount}
                    </span>
                  )}

                  {isReportsTab &&
                    reportsBadge.unreadCount === 0 &&
                    reportsBadge.totalCount > 0 && (
                      <span
                        title={`Wszystkie raporty: ${reportsBadge.totalCount}`}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold shrink-0 ${
                          isActive
                            ? 'bg-white/25 text-white'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {reportsBadge.totalCount}
                      </span>
                    )}

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

                  {isSharedTab && sharedBadge.unreadCount > 0 && (
                    <span
                      title={`Nowe przesłane przetargi: ${sharedBadge.unreadCount}`}
                      className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-red-600 text-white shrink-0"
                    >
                      {sharedBadge.unreadCount}
                    </span>
                  )}

                  {isSharedTab &&
                    sharedBadge.unreadCount === 0 &&
                    sharedBadge.totalCount > 0 && (
                      <span
                        title={`Przesłane przetargi: ${sharedBadge.totalCount}`}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold shrink-0 ${
                          isActive
                            ? 'bg-white/25 text-white'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {sharedBadge.totalCount}
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

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setBackupModalOpen(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition cursor-pointer bg-emerald-50 text-black border border-emerald-400 hover:bg-emerald-100"
                  >
                    <Database size={18} className="text-emerald-700" />
                    Backup JSON
                  </button>
                )}
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

      <main key={`${auth.username}:${viewRefreshKey}`} className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'search' && <SearchView />}
        {activeTab === 'automation' && <AutomationView />}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'tenders' && <TendersView />}
        {activeTab === 'observed' && <ObservedView />}
        {activeTab === 'shared' && <SharedInboxView />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'endpoints' && permissions.includes('ENDPOINTS') && <EndpointsView />}
        {activeTab === 'keywords' && permissions.includes('KEYWORDS') && <KeywordsView />}
        {activeTab === 'smtp' && permissions.includes('SMTP') && <SmtpView />}
        {activeTab === 'ai' && permissions.includes('ai') && <AiConfigView />}
        {activeTab === 'groups' && permissions.includes('groups') && <GroupsView />}
        {activeTab === 'users' && permissions.includes('USERS') && <UsersView />}
      </main>
    </div>
  );
}