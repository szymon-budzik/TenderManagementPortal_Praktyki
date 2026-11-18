import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import {
  FileSpreadsheet,
  Mail,
  Trash2,
  Download,
  ArrowUpDown,
} from 'lucide-react';

function parseEmailTags(raw) {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter(Boolean);
}

export default function ReportsView() {
  const [runs, setRuns] = useState([]);
  const [smtpAccounts, setSmtpAccounts] = useState([]);
  const [selectedRunIds, setSelectedRunIds] = useState([]);
  const [manualEmails, setManualEmails] = useState('');
  const [manualSmtpId, setManualSmtpId] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [runSort, setRunSort] = useState({ key: 'id', dir: 'desc' });

  const fetchReportsData = async () => {
    try {
      const [runsRes, smtpRes] = await Promise.all([
        api.get('/automation/runs').catch(() => ({ data: [] })),
        api.get('/automation/smtp-accounts').catch(() => ({ data: [] })),
      ]);
      const smtpList = smtpRes.data || [];
      setRuns(runsRes.data || []);
      setSmtpAccounts(smtpList);
      if (smtpList.length > 0 && !manualSmtpId) {
        setManualSmtpId(String(smtpList[0].id));
      }
    } catch (err) {
      console.error('Błąd pobierania raportów:', err);
    }
  };

  useEffect(() => {
    fetchReportsData();
    const interval = setInterval(async () => {
      try {
        const runsRes = await api.get('/automation/runs');
        setRuns(runsRes.data || []);
      } catch {
        // Ciche odświeżanie listy pobrań w tle co 10s
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const toggleSelectRun = (id) => {
    setSelectedRunIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const removeManualEmailTag = (indexToRemove) => {
    const tags = parseEmailTags(manualEmails);
    const next = tags.filter((_, idx) => idx !== indexToRemove).join(', ');
    setManualEmails(next);
  };

  const downloadBase64Excel = (base64Data, filename = 'raport_przetargi.xlsx') => {
    if (!base64Data) return;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSelectedExcel = async () => {
    if (selectedRunIds.length === 0) return;
    setLoadingAction(true);
    try {
      const res = await api.post('/automation/runs/export', { runIds: selectedRunIds });
      downloadBase64Excel(res.data.base64, res.data.filename);
    } catch (err) {
      console.error('Błąd pobierania Excela:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSendSelectedByEmail = async () => {
    if (selectedRunIds.length === 0 || !manualEmails.trim()) return;
    setLoadingAction(true);
    try {
      const res = await api.post('/automation/runs/email', {
        runIds: selectedRunIds,
        emails: manualEmails,
        smtpAccountId: manualSmtpId ? Number(manualSmtpId) : null,
      });
      if (!res.data.sent && res.data.base64) {
        downloadBase64Excel(res.data.base64, res.data.filename || 'raport_przetargi.xlsx');
      }
    } catch (err) {
      console.error('Błąd wysyłki e-mail:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const confirmDeleteRun = (run) => {
    setConfirmDialog({
      title: 'Usuń wpis z historii pobrań',
      message: `Czy na pewno chcesz usunąć pobranie #${run.id} (${run.sourceType})?`,
      onConfirm: async () => {
        try {
          await api.delete(`/automation/runs/${run.id}`);
          setSelectedRunIds((prev) => prev.filter((item) => item !== run.id));
          fetchReportsData();
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const toggleSort = (key) => {
    setRunSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedRuns = useMemo(() => {
    const copy = [...runs];
    copy.sort((a, b) => {
      const { key, dir } = runSort;
      const mult = dir === 'asc' ? 1 : -1;
      const valA = a[key] ?? '';
      const valB = b[key] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * mult;
      }
      return String(valA).localeCompare(String(valB), 'pl') * mult;
    });
    return copy;
  }, [runs, runSort]);

  const manualEmailTags = parseEmailTags(manualEmails);

  return (
    <div className="space-y-6 text-black">
      {confirmDialog && (
        <ConfirmModal
          isOpen={true}
          open={true}
          title={confirmDialog.title}
          message={confirmDialog.message}
          description={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          onClose={() => setConfirmDialog(null)}
        />
      )}

      <div>
        <h2 className="text-2xl font-extrabold text-black">
          Raporty Excel i Ręczna Wysyłka E-mail
        </h2>
        <p className="text-sm font-medium text-black mt-1">
          Zaznacz jedno lub kilka pobrań z listy poniżej, aby pobrać zbiorczy arkusz Excel (.xlsx) lub wysłać go na wskazane adresy e-mail.
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl border-2 border-blue-600 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={22} className="text-blue-600" />
            <div>
              <h3 className="text-lg font-extrabold text-black">
                Lista wszystkich pobrań (Zaznacz jedno lub kilka)
              </h3>
              <p className="text-xs font-medium text-black">
                Kliknij w nagłówek dowolnej kolumny, aby posortować tabelę. Lista odświeża się automatycznie po wykonaniu zadań Crona.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedRunIds(runs.map((r) => r.id))}
              className="px-3 py-1.5 text-xs font-bold bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 cursor-pointer"
            >
              Zaznacz wszystkie
            </button>
            <button
              type="button"
              onClick={() => setSelectedRunIds([])}
              className="px-3 py-1.5 text-xs font-bold bg-white border border-blue-300 rounded-lg hover:bg-blue-50 cursor-pointer"
            >
              Odznacz wszystkie
            </button>
          </div>
        </div>

        <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-300 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <label className="block text-xs font-extrabold uppercase mb-1">
                Adresy e-mail odbiorców (rozdzielone przecinkiem) — Zaznaczono: {selectedRunIds.length}
              </label>
              <input
                type="text"
                value={manualEmails}
                onChange={(e) => setManualEmails(e.target.value)}
                placeholder="np. jan.kowalski@firma.pl, dzial.ofert@firma.pl"
                className="w-full px-3.5 py-2 border border-blue-400 rounded-lg bg-white text-black text-sm font-mono"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-extrabold uppercase mb-1">
                Wyślij przez konto SMTP
              </label>
              <select
                value={manualSmtpId}
                onChange={(e) => setManualSmtpId(e.target.value)}
                className="w-full px-3 py-2 border border-blue-400 rounded-lg bg-white text-black text-xs font-bold"
              >
                <option value="">Domyślne konto SMTP</option>
                {smtpAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.smtpUsername || acc.username})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <button
                type="button"
                disabled={loadingAction}
                onClick={handleSendSelectedByEmail}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-lg text-xs cursor-pointer"
              >
                <Mail size={15} />
                Wyślij Excel
              </button>
            </div>

            <div className="md:col-span-2">
              <button
                type="button"
                disabled={loadingAction}
                onClick={handleDownloadSelectedExcel}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-green-400 hover:bg-green-500 border-2 border-green-800 text-black font-extrabold rounded-lg text-xs cursor-pointer"
              >
                <Download size={15} />
                Pobierz .xlsx
              </button>
            </div>
          </div>

          {manualEmailTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {manualEmailTags.map((email, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-200 border border-slate-400 rounded-md text-xs font-bold text-black"
                >
                  <Mail size={12} className="text-slate-700" />
                  {email}
                  <button
                    type="button"
                    onClick={() => removeManualEmailTag(idx)}
                    className="hover:text-red-700 font-extrabold cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-blue-200 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-blue-600 text-white select-none">
                <th className="p-3.5 font-bold w-12 text-center">Wybór</th>
                <th
                  onClick={() => toggleSort('id')}
                  className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    ID Pob. <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('createdAt')}
                  className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Data i godzina <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('sourceType')}
                  className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Tryb <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('sourcesSummary')}
                  className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Źródła danych <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('totalFetched')}
                  className="p-3.5 font-bold text-center cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Pobrano <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('savedCount')}
                  className="p-3.5 font-bold text-center cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Zapisano (&gt;0 pkt) <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('excludedCount')}
                  className="p-3.5 font-bold text-center cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Wykluczono <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="p-3.5 font-bold text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {sortedRuns.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-6 text-center font-medium text-black">
                    Brak zarejestrowanych pobrań.
                  </td>
                </tr>
              ) : (
                sortedRuns.map((r) => {
                  const checked = selectedRunIds.includes(r.id);
                  const isCron = r.sourceType && r.sourceType.toUpperCase().startsWith('CRON');
                  const modeLabel =
                    r.sourceType === 'MANUAL' ? 'RĘCZNE' : r.sourceType || 'RĘCZNE';

                  return (
                    <tr
                      key={r.id}
                      onClick={() => toggleSelectRun(r.id)}
                      className={`transition cursor-pointer ${
                        checked ? 'bg-blue-100/70 font-semibold' : 'hover:bg-blue-50/50'
                      }`}
                    >
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectRun(r.id)}
                          className="w-5 h-5 accent-blue-600 cursor-pointer"
                        />
                      </td>
                      <td className="p-3.5 font-mono font-bold">#{r.id}</td>
                      <td className="p-3.5 whitespace-nowrap">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString('pl-PL') : '—'}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded text-xs font-extrabold border ${
                            isCron
                              ? 'bg-amber-200 border-amber-700 text-black'
                              : 'bg-blue-100 border-blue-600 text-black'
                          }`}
                        >
                          {modeLabel}
                        </span>
                      </td>
                      <td className="p-3.5 text-xs">{r.sourcesSummary || '—'}</td>
                      <td className="p-3.5 text-center font-bold">{r.totalFetched}</td>
                      <td className="p-3.5 text-center">
                        <span className="px-2.5 py-0.5 rounded bg-green-300 border border-green-800 font-extrabold text-xs">
                          {r.savedCount}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-bold">{r.excludedCount}</td>
                      <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => confirmDeleteRun(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-red-400 hover:bg-red-100 text-black rounded-lg font-bold text-xs cursor-pointer"
                        >
                          <Trash2 size={14} /> Usuń
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}