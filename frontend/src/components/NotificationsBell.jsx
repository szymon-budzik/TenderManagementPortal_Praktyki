import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import {
  Bell,
  CheckCircle2,
  XCircle,
  X,
  ChevronDown,
  ChevronUp,
  Send,
  FileSpreadsheet,
} from 'lucide-react';

export default function NotificationsBell({ onNavigateTab }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  // ID powiadomień, które były nowe w momencie otwarcia panelu (żeby w liście nadal miały niebieską kropkę)
  const [freshUnreadIds, setFreshUnreadIds] = useState(() => new Set());
  const wrapperRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/automation/notifications');
      const data = res.data || [];
      setNotifications(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadQuietly = async () => {
      try {
        const res = await api.get('/automation/notifications');
        if (!cancelled) {
          setNotifications(res.data || []);
        }
      } catch {
        // Ignoruj
      }
    };
    loadQuietly();
    const interval = setInterval(loadQuietly, 5000);
    const handleImmediateRefresh = () => {
      loadQuietly();
    };
    window.addEventListener('notificationsUpdated', handleImmediateRefresh);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('notificationsUpdated', handleImmediateRefresh);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const showRedDot = !open && unreadCount > 0;

  const closePanel = useCallback(async () => {
    setOpen(false);
    setExpandedId(null);
    setFreshUnreadIds(new Set());

    // Jeśli podczas otwartego panelu wpadło jeszcze nowsze powiadomienie — oznacz je jako przeczytane
    if (notifications.some((n) => !n.isRead)) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      try {
        await api.patch('/automation/notifications/read-all');
      } catch {
        // Ignoruj
      }
    }
  }, [notifications]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (open && wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        closePanel();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, closePanel]);

  const handleToggleBell = async () => {
    if (open) {
      closePanel();
      return;
    }

    // Natychmiast otwieramy panel (czerwona kropka znika od razu po kliknięciu)
    setOpen(true);

    const latest = (await fetchNotifications()) || notifications;
    const unreadIds = latest.filter((n) => !n.isRead).map((n) => n.id);

    if (unreadIds.length > 0) {
      // Zachowujemy niebieską kropkę wewnątrz otwartej listy, ale w bazie już oznaczamy jako odebrane
      setFreshUnreadIds(new Set(unreadIds));
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      try {
        await api.patch('/automation/notifications/read-all');
      } catch {
        // Ignoruj
      }
    }
  };

  const handleClickNotification = async (notif) => {
    setExpandedId((prev) => (prev === notif.id ? null : notif.id));

    if (freshUnreadIds.has(notif.id)) {
      setFreshUnreadIds((prev) => {
        const next = new Set(prev);
        next.delete(notif.id);
        return next;
      });
    }

    if (!notif.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      try {
        await api.patch(`/automation/notifications/${notif.id}/read`);
      } catch {
        // Ignoruj
      }
    }
  };

  const handleDeleteNotification = async (e, id) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setFreshUnreadIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (expandedId === id) setExpandedId(null);
    try {
      await api.delete(`/automation/notifications/${id}`);
    } catch {
      fetchNotifications();
    }
  };

  return (
    <div ref={wrapperRef} className="relative inline-flex items-center">
      {/* Kółeczko z ikoną dzwoneczka */}
      <button
        type="button"
        onClick={handleToggleBell}
        title="Powiadomienia"
        className={`relative w-8 h-8 rounded-full border-2 flex items-center justify-center transition cursor-pointer shrink-0 ${
          open
            ? 'bg-blue-600 border-blue-800 text-white'
            : 'bg-blue-50 hover:bg-blue-100 border-blue-600 text-black'
        }`}
      >
        <Bell size={15} />
        {showRedDot && (
          <span
            title={`Nowe powiadomienia: ${unreadCount}`}
            className="absolute -top-0.5 -right-0.5 flex h-3 w-3"
          >
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 ring-2 ring-white" />
          </span>
        )}
      </button>

      {/* Rozwijana lista powiadomień */}
      {open && (
        <div className="absolute left-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border-2 border-blue-600 shadow-xl z-50 overflow-hidden text-black">
          <div className="px-4 py-3 bg-blue-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={16} />
              <span className="font-extrabold text-sm">
                Powiadomienia
              </span>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="p-1 rounded hover:bg-white/20 cursor-pointer"
              title="Zamknij"
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto divide-y divide-blue-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs font-semibold text-slate-600">
                Brak powiadomień.
              </div>
            ) : (
              notifications.map((n) => {
                const isExpanded = expandedId === n.id;
                const isNewInList = !n.isRead || freshUnreadIds.has(n.id);
                const notifType = n.notificationType || 'AUTOMATION';
                const isSharedTender = notifType === 'SHARED_TENDER';
                const isSharedReport = notifType === 'SHARED_REPORT';

                return (
                  <div
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    className={`p-3.5 transition cursor-pointer ${
                      isNewInList
                        ? 'bg-blue-50/70 hover:bg-blue-100/70'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {isSharedTender ? (
                        <Send
                          size={18}
                          className="text-purple-700 shrink-0 mt-0.5"
                        />
                      ) : isSharedReport ? (
                        <FileSpreadsheet
                          size={18}
                          className="text-blue-600 shrink-0 mt-0.5"
                        />
                      ) : n.success ? (
                        <CheckCircle2
                          size={18}
                          className="text-green-700 shrink-0 mt-0.5"
                        />
                      ) : (
                        <XCircle
                          size={18}
                          className="text-red-700 shrink-0 mt-0.5"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isNewInList && (
                            <span
                              title="Nowe powiadomienie"
                              className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"
                            />
                          )}
                          <div className="font-extrabold text-xs text-black truncate">
                            {n.title}
                          </div>
                        </div>

                        {n.summary && (
                          <div className="text-xs font-medium text-black/85 mt-1 leading-snug">
                            {n.summary}
                          </div>
                        )}

                        {onNavigateTab && (isSharedTender || isSharedReport) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              closePanel();
                              onNavigateTab(isSharedTender ? 'shared' : 'reports');
                            }}
                            className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-100 hover:bg-blue-200 border border-blue-400 text-[11px] font-extrabold text-blue-900 cursor-pointer"
                          >
                            {isSharedTender ? 'Otwórz zakładkę Przesłane →' : 'Otwórz zakładkę Raporty →'}
                          </button>
                        )}

                        <div className="flex items-center justify-between mt-1.5 text-[11px] font-semibold text-slate-600">
                          <span>
                            {n.createdAt
                              ? new Date(n.createdAt).toLocaleString('pl-PL')
                              : '—'}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-blue-700 font-bold">
                            {isExpanded ? 'Ukryj szczegóły' : 'Szczegóły'}
                            {isExpanded ? (
                              <ChevronUp size={13} />
                            ) : (
                              <ChevronDown size={13} />
                            )}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteNotification(e, n.id)}
                        title="Usuń powiadomienie"
                        className="p-1 rounded-md text-slate-500 hover:text-red-700 hover:bg-red-100 transition cursor-pointer shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {isExpanded && n.details && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2.5 pt-2.5 border-t border-blue-200"
                      >
                        <pre
                          className={`p-2.5 rounded-lg text-[11px] font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto border ${
                            n.success
                              ? 'bg-slate-50 border-blue-200 text-black'
                              : 'bg-red-50 border-red-300 text-black'
                          }`}
                        >
                          {n.details}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}