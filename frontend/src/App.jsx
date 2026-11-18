import { useState, useEffect } from 'react';
import api from './api';
import LoginView from './components/LoginView';
import SearchView from './components/SearchView';
import AutomationView from './components/AutomationView';
import ReportsView from './components/ReportsView';
import TendersView from './components/TendersView';
import AnalyticsView from './components/AnalyticsView';
import EndpointsView from './components/EndpointsView';
import KeywordsView from './components/KeywordsView';
import SmtpView from './components/SmtpView';
import UsersView from './components/UsersView';
import {
  Search,
  Clock,
  FileSpreadsheet,
  FileText,
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

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    const handleForceLogout = () => setAuth(null);
    window.addEventListener('rolesUpdated', handleUpdate);
    window.addEventListener('authForceLogout', handleForceLogout);
    return () => {
      window.removeEventListener('rolesUpdated', handleUpdate);
      window.removeEventListener('authForceLogout', handleForceLogout);
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
      .then(() => setCheckingSession(false))
      .catch(() => {
        handleLogout();
        setCheckingSession(false);
      });
  }, []);

  if (checkingSession) {
    return null;
  }

  if (!auth) {
    return <LoginView onLoginSuccess={(data) => setAuth(data)} />;
  }

  const effectiveRole = getEffectiveUserRole(auth.username, auth.role);
  const permissions = getRolePermissions(effectiveRole);

  // Zakładki dostępne dla każdego (Automatyzacja, a bezpośrednio pod nią Raporty)
  const alwaysAvailableItems = [
    { id: 'search', label: 'Wyszukiwarka', icon: Search },
    { id: 'automation', label: 'Automatyzacja', icon: Clock },
    { id: 'reports', label: 'Raporty', icon: FileSpreadsheet },
    { id: 'tenders', label: 'Przetargi', icon: FileText },
    { id: 'analytics', label: 'Statystyki', icon: BarChart3 },
  ];

  // Zakładki zależne od uprawnień roli (SMTP bezpośrednio pod Keywordsami)
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
            <p className="text-xs font-semibold text-black mt-1">
              Zalogowany: <span className="underline">{auth.username}</span>
            </p>
          </div>

          <nav className="p-4 space-y-2">
            {alwaysAvailableItems.map((item) => {
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
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'endpoints' && permissions.includes('ENDPOINTS') && <EndpointsView />}
        {activeTab === 'keywords' && permissions.includes('KEYWORDS') && <KeywordsView />}
        {activeTab === 'smtp' && permissions.includes('SMTP') && <SmtpView />}
        {activeTab === 'users' && permissions.includes('USERS') && <UsersView />}
      </main>
    </div>
  );
}