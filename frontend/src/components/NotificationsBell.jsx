import { useState, useEffect, useRef } from 'react';
import api from '../api';
import {
  Bell,
  CheckCircle2,
  XCircle,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function NotificationsBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const wrapperRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/automation/notifications');
      setNotifications(res.data || []);
    } catch {
      // Ciche pominięcie błędu przy odpytywaniu w tle
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Zamknięcie panelu oznacza obejrzane powiadomienia jako przeczytane (znika niebieska kropka)
  const closePanelAndMarkSeen = async () => {
    setOpen(false);
    setExpandedId(null);
    if (notifications.some((n) => !n.isRead)) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      try {
        await api.patch('/automation/notifications/read-all');
      } catch {
        // Ignoruj
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (open && wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        closePanelAndMarkSeen();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, notifications]);

  const handleToggleBell = () => {
    if (open) {
      closePanelAndMarkSeen();
    } else {
      fetchNotifications();
      setOpen(true);
    }
  };

  const handleClickNotification = async (notif) => {
    setExpandedId((prev) => (prev === notif.id ? null : notif.id));
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
        title="Powiadomienia automatyzacji"
        className={`relative w-8 h-8 rounded-full border-2 flex items-center justify-center transition cursor-pointer shrink-0 ${
          open
            ? 'bg-blue-600 border-blue-800 text-white'
            : 'bg-blue-50 hover:bg-blue-100 border-blue-600 text-black'
        }`}
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span
            title={`Nowe powiadomienia: ${unreadCount}`}
            className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-600 ring-2 ring-white"
          />
        )}
      </button>

      {/* Rozwijana lista powiadomień */}
      {open && (
        <div className="absolute left-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border-2 border-blue-600 shadow-xl z-50 overflow-hidden text-black">
          <div className="px-4 py-3 bg-blue-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={16} />
              <span className="font-extrabold text-sm">
                Powiadomienia automatyzacji
              </span>
            </div>
            <button
              type="button"
              onClick={closePanelAndMarkSeen}
              className="p-1 rounded hover:bg-white/20 cursor-pointer"
              title="Zamknij"
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto divide-y divide-blue-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs font-semibold text-slate-600">
                Brak powiadomień z automatyzacji.
              </div>
            ) : (
              notifications.map((n) => {
                const isExpanded = expandedId === n.id;

                return (
                  <div
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    className={`p-3.5 transition cursor-pointer ${
                      !n.isRead
                        ? 'bg-blue-50/70 hover:bg-blue-100/70'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Status sukces / błąd */}
                      {n.success ? (
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
                          {/* Niebieska kropeczka dla nowego (pierwszy raz widzianego) powiadomienia */}
                          {!n.isRead && (
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

                      {/* Mały "x" do usunięcia powiadomienia */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteNotification(e, n.id)}
                        title="Usuń powiadomienie"
                        className="p-1 rounded-md text-slate-500 hover:text-red-700 hover:bg-red-100 transition cursor-pointer shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Rozwijane szczegóły powiadomienia (przyczyna błędu / logi) */}
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