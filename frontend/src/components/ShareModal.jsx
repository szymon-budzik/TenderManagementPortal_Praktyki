import { useState, useEffect, useMemo } from 'react';
import { Send, X, Search, Users, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getSharePeers, shareTendersToUsers, shareReportsToUsers } from '../services/sharesApi';

export default function ShareModal(props) {
  if (!props.isOpen) return null;
  const modalKey = `${props.mode}:${(props.itemIds || []).join(',')}`;
  return <ShareModalInner key={modalKey} {...props} />;
}

function ShareModalInner({
  mode, // 'TENDERS' | 'REPORTS'
  itemIds,
  itemLabel,
  onClose,
  onShared,
}) {
  const [peers, setPeers] = useState([]);
  const [loadingPeers, setLoadingPeers] = useState(true);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [infoNotice, setInfoNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    getSharePeers()
      .then((data) => {
        if (!cancelled) setPeers(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Nie udało się pobrać listy osób w Twoich grupach.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPeers(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPeers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return peers;
    return peers.filter(
      (p) =>
        (p.username || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.sharedGroups || []).some((g) => g.toLowerCase().includes(q))
    );
  }, [peers, query]);

  const isReports = mode === 'REPORTS';
  const count = Array.isArray(itemIds) ? itemIds.length : 0;

  const toggleRecipient = (uid) => {
    setSelectedRecipientIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (selectedRecipientIds.length === 0 || count === 0) return;
    setError('');
    setInfoNotice('');
    setSending(true);
    try {
      const result = isReports
        ? await shareReportsToUsers(selectedRecipientIds, itemIds, note.trim())
        : await shareTendersToUsers(selectedRecipientIds, itemIds, note.trim());

      const sharedCount = result?.sharedItemsCount ?? 0;
      const skippedCount = result?.skippedCount ?? 0;

      if (sharedCount === 0 && skippedCount > 0) {
        setInfoNotice(
          result?.message ||
            `Wybrany odbiorca ma już te przetargi (pominięto duplikaty: ${skippedCount}).`
        );
        return;
      }

      window.dispatchEvent(new Event('notificationsUpdated'));
      window.dispatchEvent(new Event('sharedUpdated'));
      if (isReports) {
        window.dispatchEvent(new Event('reportsUpdated'));
      }
      if (onShared) {
        const fallbackMsg =
          skippedCount > 0
            ? `Udostępniono ${sharedCount} pozycji, pominięto ${skippedCount} (odbiorca już je ma).`
            : undefined;
        onShared({
          ...result,
          message: result?.message || fallbackMsg,
        });
      }
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Nie udało się przesłać wybranych pozycji.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border-2 border-blue-600 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden text-black"
      >
        {/* Nagłówek */}
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Send size={19} className="shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-extrabold truncate">
                {isReports
                  ? `Prześlij raporty w systemie (${count})`
                  : `Prześlij przetargi (${count})`}
              </h3>
              <p className="text-xs text-blue-100 font-semibold truncate">
                {itemLabel ||
                  (isReports
                    ? 'Wybrane raporty pojawią się u odbiorcy w zakładce Raporty z powiadomieniem'
                    : 'Wybrane przetargi pojawią się u odbiorcy w zakładce Przesłane z powiadomieniem')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 cursor-pointer shrink-0"
            aria-label="Zamknij"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSend} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 space-y-3 border-b border-blue-100">
            {error && (
              <div className="p-3 bg-red-50 border border-red-500 rounded-xl text-xs font-bold text-black flex items-center gap-2">
                <AlertCircle size={15} className="text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {infoNotice && (
              <div className="p-3 bg-amber-50 border-2 border-amber-500 rounded-xl text-xs font-extrabold text-black flex items-center gap-2">
                <AlertCircle size={15} className="text-amber-700 shrink-0" />
                <span>{infoNotice}</span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-black flex items-start gap-2">
              <Users size={15} className="text-blue-600 shrink-0 mt-0.5" />
              <span>
                Na liście widoczni są wyłącznie użytkownicy z Twoich grup i podgrup. Odbiorca otrzyma od razu powiadomienie w dzwoneczku.
              </span>
            </div>

            {peers.length > 0 && (
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj odbiorcy po loginie, e-mailu lub grupie..."
                  className="w-full pl-9 pr-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black"
                />
              </div>
            )}
          </div>

          {/* Lista odbiorców */}
          <div className="p-4 overflow-y-auto flex-1 space-y-2">
            {loadingPeers ? (
              <div className="py-6 text-center text-xs font-bold text-black">
                Ładowanie listy użytkowników z Twoich grup...
              </div>
            ) : peers.length === 0 ? (
              <div className="p-5 rounded-xl border-2 border-dashed border-blue-300 bg-slate-50 text-center space-y-1.5">
                <div className="text-sm font-extrabold text-black">
                  Brak dostępnych odbiorców w Twoich grupach
                </div>
                <p className="text-xs font-medium text-black opacity-80">
                  Aby przesyłać przetargi lub raporty, Ty i odbiorca musicie należeć do wspólnej grupy głównej lub podgrupy (ustawienia w zakładce <b>Grupy</b>).
                </p>
              </div>
            ) : filteredPeers.length === 0 ? (
              <div className="py-6 text-center text-xs font-semibold text-black">
                Brak odbiorców pasujących do wyszukiwania.
              </div>
            ) : (
              filteredPeers.map((peer) => {
                const checked = selectedRecipientIds.includes(peer.userId);
                return (
                  <label
                    key={peer.userId}
                    className={`flex items-start justify-between gap-3 px-3.5 py-2.5 rounded-xl border-2 cursor-pointer transition ${
                      checked
                        ? 'bg-blue-50 border-blue-600'
                        : 'bg-white border-blue-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRecipient(peer.userId)}
                        className="w-4 h-4 mt-0.5 accent-blue-600 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-extrabold text-sm text-black truncate">
                          {peer.username}
                        </div>
                        <div className="text-xs text-black opacity-75 truncate">{peer.email}</div>
                        {peer.sharedGroups && peer.sharedGroups.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {peer.sharedGroups.map((g, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-blue-100 border border-blue-300 text-[10px] font-extrabold text-blue-900"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {checked && <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" />}
                  </label>
                );
              })
            )}
          </div>

          {/* Wiadomość opcjonalna + przyciski */}
          <div className="p-4 bg-slate-50 border-t border-blue-100 space-y-3">
            <div>
              <label className="block text-[11px] font-extrabold uppercase mb-1 text-black">
                Wiadomość / notatka (opcjonalnie)
              </label>
              <input
                type="text"
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="np. Zerknij proszę, termin składania w piątek"
                className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-xs font-semibold text-black"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-extrabold text-black">
                Wybrani odbiorcy: {selectedRecipientIds.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-black font-bold rounded-lg text-xs cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={sending || selectedRecipientIds.length === 0 || count === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-lg text-xs cursor-pointer"
                >
                  <Send size={14} />
                  {sending ? 'Przesyłanie...' : 'Prześlij'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
