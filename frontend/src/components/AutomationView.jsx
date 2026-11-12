import { useState, useEffect } from 'react';
import api from '../api';
import {
  Clock,
  FileSpreadsheet,
  Mail,
  Play,
  Save,
  Trash2,
  CheckCircle2,
  XCircle,
  Settings,
  Download,
} from 'lucide-react';

export default function AutomationView() {
  const [runs, setRuns] = useState([]);
  const [selectedRunIds, setSelectedRunIds] = useState([]);
  const [manualEmails, setManualEmails] = useState('');
  const [showSmtpSettings, setShowSmtpSettings] = useState(false);
  const [banner, setBanner] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const [cron, setCron] = useState({
    enabled: false,
    cronTime: '08:00',
    matchMode: 'ANY',
    recipientEmails: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    lastRunAt: null,
    lastRunStatus: '',
  });

  const fetchAll = async () => {
    try {
      const [runsRes, cronRes] = await Promise.all([
        api.get('/automation/runs'),
        api.get('/automation/cron'),
      ]);
      setRuns(runsRes.data || []);
      if (cronRes.data) {
        setCron((prev) => ({ ...prev, ...cronRes.data }));
      }
    } catch (err) {
      console.error('Błąd pobierania danych automatyzacji:', err);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const toggleSelectRun = (id) => {
    setSelectedRunIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
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

  const handleSaveCron = async (e) => {
    e.preventDefault();
    setBanner(null);
    try {
      const res = await api.put('/automation/cron', cron);
      setCron(res.data);
      setBanner({
        type: 'success',
        title: 'Zapisano konfigurację Crona',
        text: `Harmonogram jest ${res.data.enabled ? 'AKTYWNY (godzina ' + res.data.cronTime + ')' : 'WYŁĄCZONY'}.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        title: 'Błąd zapisu harmonogramu',
        text: err.response?.data?.message || 'Nie udało się zapisać ustawień Crona.',
      });
    }
  };

  const handleTriggerCronNow = async () => {
    setBanner(null);
    setLoadingAction(true);
    try {
      await api.put('/automation/cron', cron);
      const res = await api.post('/automation/cron/trigger');
      await fetchAll();
      setBanner({
        type: 'success',
        title: 'Wykonano zadanie Crona',
        text: `Pobrano: ${res.data.totalFetched}, Zapisano (>0 pkt): ${res.data.savedCount}, Wykluczono: ${res.data.excludedCount}.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        title: 'Błąd uruchomienia Crona',
        text: err.response?.data?.message || 'Wystąpił błąd podczas wykonywania zadania.',
      });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDownloadSelectedExcel = async () => {
    setBanner(null);
    if (selectedRunIds.length === 0) {
      setBanner({
        type: 'error',
        title: 'Brak zaznaczonych pobrań',
        text: 'Zaznacz przynajmniej jedno pobranie z tabeli poniżej.',
      });
      return;
    }

    setLoadingAction(true);
    try {
      const res = await api.post('/automation/runs/export', { runIds: selectedRunIds });
      downloadBase64Excel(res.data.base64, res.data.filename);
      setBanner({
        type: 'success',
        title: 'Pobrano plik Excel (.xlsx)',
        text: `Wygenerowano arkusz Pandas zawierający ${res.data.count} przetargów z ${selectedRunIds.length} wybranych pobrań.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        title: 'Błąd generowania Excela',
        text: err.response?.data?.message || 'Nie udało się wygenerować pliku Excel.',
      });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSendSelectedByEmail = async () => {
    setBanner(null);
    if (selectedRunIds.length === 0) {
      setBanner({
        type: 'error',
        title: 'Brak zaznaczonych pobrań',
        text: 'Zaznacz na liście poniżej jedno lub kilka pobrań, które chcesz wysłać.',
      });
      return;
    }
    if (!manualEmails.trim()) {
      setBanner({
        type: 'error',
        title: 'Brak adresów e-mail',
        text: 'Wpisz adres(y) e-mail odbiorców (rozdzielone przecinkiem).',
      });
      return;
    }

    setLoadingAction(true);
    try {
      const res = await api.post('/automation/runs/email', {
        runIds: selectedRunIds,
        emails: manualEmails,
      });
      if (!res.data.sent && res.data.base64) {
        downloadBase64Excel(res.data.base64, 'raport_przetargi.xlsx');
      }
      setBanner({
        type: res.data.sent ? 'success' : 'error',
        title: res.data.sent ? 'Wysłano raport Excel na e-mail' : 'Wygenerowano plik Excel (Brak konfiguracji SMTP)',
        text: res.data.message,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        title: 'Błąd wysyłki e-mail',
        text: err.response?.data?.message || 'Nie udało się wysłać wiadomości z raportem.',
      });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteRun = async (id) => {
    if (!confirm('Usunąć ten wpis z historii pobrań?')) return;
    await api.delete(`/automation/runs/${id}`);
    setSelectedRunIds((prev) => prev.filter((item) => item !== id));
    fetchAll();
  };

  return (
    <div className="space-y-8 text-black">
      <div>
        <h2 className="text-2xl font-extrabold text-black">Automatyzacja (Cron) i Eksport Excel</h2>
        <p className="text-sm font-medium text-black mt-1">
          Konfiguruj automatyczne pobieranie z wysyłką na e-mail oraz generuj i rozsyłaj arkusze Excel z wybranych pobrań.
        </p>
      </div>

      {banner && (
        <div
          className={`flex items-start justify-between gap-4 p-4 rounded-xl border-2 shadow-xs ${
            banner.type === 'success'
              ? 'bg-green-100 border-green-700 text-black'
              : 'bg-red-100 border-red-700 text-black'
          }`}
        >
          <div className="flex items-start gap-3">
            {banner.type === 'success' ? (
              <CheckCircle2 size={22} className="text-green-800 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={22} className="text-red-800 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-extrabold text-sm">{banner.title}</div>
              <div className="text-sm mt-0.5">{banner.text}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="px-2 py-0.5 font-bold rounded hover:bg-black/10 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* SEKCJA 1: HARMONOGRAM CRON + AUTO-EMAIL */}
      <form
        onSubmit={handleSaveCron}
        className="bg-white p-6 rounded-xl border-2 border-blue-600 shadow-xs space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blue-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Clock size={22} className="text-blue-600" />
            <div>
              <h3 className="text-lg font-extrabold text-black">
                1. Harmonogram automatyczny (Cron) i Auto-Wysyłka E-mail
              </h3>
              {cron.lastRunAt && (
                <p className="text-xs font-semibold text-black">
                  Ostatnie uruchomienie: {new Date(cron.lastRunAt).toLocaleString('pl-PL')} — {cron.lastRunStatus}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCron({ ...cron, enabled: !cron.enabled })}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold border-2 transition cursor-pointer ${
                cron.enabled
                  ? 'bg-green-400 hover:bg-green-500 border-green-800 text-black'
                  : 'bg-red-400 hover:bg-red-500 border-red-800 text-black'
              }`}
            >
              CRON: {cron.enabled ? 'AKTYWNY' : 'WYŁĄCZONY'}
            </button>

            <button
              type="button"
              onClick={() => setShowSmtpSettings(!showSmtpSettings)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-blue-400 hover:bg-blue-50 rounded-xl text-xs font-bold cursor-pointer"
            >
              <Settings size={15} />
              Konfiguracja serwera SMTP
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold uppercase mb-1">
              Godzina uruchomienia (codziennie)
            </label>
            <input
              type="time"
              value={cron.cronTime || '08:00'}
              onChange={(e) => setCron({ ...cron, cronTime: e.target.value })}
              className="w-full px-3.5 py-2 border border-blue-300 rounded-lg text-black font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase mb-1">
              Warunek dopasowania słów
            </label>
            <select
              value={cron.matchMode || 'ANY'}
              onChange={(e) => setCron({ ...cron, matchMode: e.target.value })}
              className="w-full px-3.5 py-2 border border-blue-300 rounded-lg bg-white text-black font-semibold"
            >
              <option value="ANY">Chociaż 1 słowo z kategorii (OR)</option>
              <option value="ALL">Wszystkie słowa z kategorii (AND)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase mb-1">
              Adresy e-mail dla Crona (automatyczna wysyłka Excela po pobraniu)
            </label>
            <input
              type="text"
              value={cron.recipientEmails || ''}
              onChange={(e) => setCron({ ...cron, recipientEmails: e.target.value })}
              placeholder="np. przetargi@firma.pl, manager@firma.pl"
              className="w-full px-3.5 py-2 border border-blue-300 rounded-lg text-black"
            />
          </div>
        </div>

        {showSmtpSettings && (
          <div className="p-4 bg-blue-50/70 border border-blue-300 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Host SMTP</label>
              <input
                type="text"
                value={cron.smtpHost || ''}
                onChange={(e) => setCron({ ...cron, smtpHost: e.target.value })}
                placeholder="np. smtp.gmail.com"
                className="w-full px-3 py-1.5 border border-blue-300 rounded bg-white text-black text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Port SMTP</label>
              <input
                type="number"
                value={cron.smtpPort || 587}
                onChange={(e) => setCron({ ...cron, smtpPort: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border border-blue-300 rounded bg-white text-black text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Login / E-mail nadawcy</label>
              <input
                type="text"
                value={cron.smtpUsername || ''}
                onChange={(e) => setCron({ ...cron, smtpUsername: e.target.value })}
                placeholder="twoj@email.pl"
                className="w-full px-3 py-1.5 border border-blue-300 rounded bg-white text-black text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Hasło / Hasło aplikacji</label>
              <input
                type="password"
                value={cron.smtpPassword || ''}
                onChange={(e) => setCron({ ...cron, smtpPassword: e.target.value })}
                placeholder="••••••••••••"
                className="w-full px-3 py-1.5 border border-blue-300 rounded bg-white text-black text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-blue-100">
          <button
            type="button"
            disabled={loadingAction}
            onClick={handleTriggerCronNow}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border-2 border-blue-600 hover:bg-blue-50 text-black font-extrabold rounded-xl text-xs cursor-pointer"
          >
            <Play size={15} />
            Testuj / Uruchom Crona teraz
          </button>

          <button
            type="submit"
            className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs cursor-pointer"
          >
            <Save size={15} />
            Zapisz ustawienia Crona
          </button>
        </div>
      </form>

      {/* SEKCJA 2: HISTORIA POBRAŃ + WYSYŁKA NA EMAIL / POBIERANIE EXCELA */}
      <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={22} className="text-blue-600" />
            <div>
              <h3 className="text-lg font-extrabold text-black">
                2. Lista wszystkich pobrań (Zaznacz jedno lub kilka)
              </h3>
              <p className="text-xs font-medium text-black">
                Zaznacz wybrane pobrania poniżej, aby połączyć je w arkusz Excel (.xlsx) i wysłać na wskazane adresy e-mail.
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

        {/* Pasek wysyłki na e-mail i pobierania pliku Excel */}
        <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-300 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6">
            <label className="block text-xs font-extrabold uppercase mb-1">
              Adresy e-mail odbiorców (rozdzielone przecinkiem) — Zaznaczono pobrań: {selectedRunIds.length}
            </label>
            <input
              type="text"
              value={manualEmails}
              onChange={(e) => setManualEmails(e.target.value)}
              placeholder="np. jan.kowalski@firma.pl, dzial.ofert@firma.pl"
              className="w-full px-3.5 py-2 border border-blue-400 rounded-lg bg-white text-black text-sm"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              disabled={loadingAction}
              onClick={handleSendSelectedByEmail}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-lg text-xs cursor-pointer"
            >
              <Mail size={16} />
              Wyślij Excel na e-mail
            </button>
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              disabled={loadingAction}
              onClick={handleDownloadSelectedExcel}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-green-400 hover:bg-green-500 border-2 border-green-800 text-black font-extrabold rounded-lg text-xs cursor-pointer"
            >
              <Download size={16} />
              Pobierz plik Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Tabela wszystkich pobrań */}
        <div className="rounded-xl border border-blue-200 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="p-3.5 font-bold w-12 text-center">Wybór</th>
                <th className="p-3.5 font-bold">ID Pob.</th>
                <th className="p-3.5 font-bold">Data i godzina</th>
                <th className="p-3.5 font-bold">Tryb</th>
                <th className="p-3.5 font-bold">Źródła danych</th>
                <th className="p-3.5 font-bold text-center">Pobrano</th>
                <th className="p-3.5 font-bold text-center">Zapisano (&gt;0 pkt)</th>
                <th className="p-3.5 font-bold text-center">Wykluczono</th>
                <th className="p-3.5 font-bold text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-6 text-center font-medium text-black">
                    Brak zarejestrowanych pobrań. Uruchom pobieranie w zakładce Wyszukiwarka lub przetestuj Crona powyżej.
                  </td>
                </tr>
              ) : (
                runs.map((r) => {
                  const checked = selectedRunIds.includes(r.id);
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
                          className={`px-2.5 py-0.5 rounded text-xs font-extrabold border ${
                            r.sourceType === 'CRON'
                              ? 'bg-amber-200 border-amber-700 text-black'
                              : 'bg-blue-100 border-blue-600 text-black'
                          }`}
                        >
                          {r.sourceType === 'CRON' ? 'CRON' : 'RĘCZNE'}
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
                          onClick={() => handleDeleteRun(r.id)}
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