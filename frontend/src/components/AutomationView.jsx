import { useState, useEffect } from 'react';
import api from '../api';
import {
  FileSpreadsheet,
  Mail,
  Play,
  Save,
  Trash2,
  CheckCircle2,
  XCircle,
  Settings,
  Download,
  Plus,
  Pencil,
  Layers,
  Globe,
  KeyRound,
  X,
} from 'lucide-react';

function parseIdList(str) {
  if (!str) return [];
  return str
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n) && n > 0);
}

export default function AutomationView() {
  const [profiles, setProfiles] = useState([]);
  const [runs, setRuns] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [categories, setCategories] = useState([]);

  const [selectedRunIds, setSelectedRunIds] = useState([]);
  const [manualEmails, setManualEmails] = useState('');
  const [showSmtpSettings, setShowSmtpSettings] = useState(false);
  const [banner, setBanner] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);

  // Formularz tworzenia / edycji profilu
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    enabled: true,
    cronTime: '08:00',
    matchMode: 'ANY',
    selectedEndpointIds: [],
    selectedCategoryIds: [],
    recipientEmails: '',
  });

  // Konfiguracja serwera SMTP
  const [smtp, setSmtp] = useState({
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
  });

  const fetchAll = async () => {
    try {
      const [profRes, runsRes, smtpRes, epRes, catRes] = await Promise.all([
        api.get('/automation/profiles'),
        api.get('/automation/runs'),
        api.get('/automation/cron'),
        api.get('/search/sources'),
        api.get('/keywords'),
      ]);
      setProfiles(profRes.data || []);
      setRuns(runsRes.data || []);
      setEndpoints(epRes.data || []);
      setCategories(catRes.data || []);
      if (smtpRes.data) {
        setSmtp({
          smtpHost: smtpRes.data.smtpHost || '',
          smtpPort: smtpRes.data.smtpPort || 587,
          smtpUsername: smtpRes.data.smtpUsername || '',
          smtpPassword: smtpRes.data.smtpPassword || '',
        });
      }
    } catch (err) {
      console.error('Błąd pobierania danych automatyzacji:', err);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(async () => {
      try {
        const [profRes, runsRes] = await Promise.all([
          api.get('/automation/profiles'),
          api.get('/automation/runs'),
        ]);
        setProfiles(profRes.data || []);
        setRuns(runsRes.data || []);
      } catch {
        // Ciche odświeżanie w tle
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const resetProfileForm = () => {
    setEditingProfileId(null);
    setProfileForm({
      name: '',
      enabled: true,
      cronTime: '08:00',
      matchMode: 'ANY',
      selectedEndpointIds: [],
      selectedCategoryIds: [],
      recipientEmails: '',
    });
  };

  const handleStartEditProfile = (p) => {
    setEditingProfileId(p.id);
    setProfileForm({
      name: p.name || '',
      enabled: Boolean(p.enabled),
      cronTime: p.cronTime || '08:00',
      matchMode: p.matchMode || 'ANY',
      selectedEndpointIds: parseIdList(p.endpointIds),
      selectedCategoryIds: parseIdList(p.categoryIds),
      recipientEmails: p.recipientEmails || '',
    });
  };

  const toggleFormEndpoint = (id) => {
    setProfileForm((prev) => ({
      ...prev,
      selectedEndpointIds: prev.selectedEndpointIds.includes(id)
        ? prev.selectedEndpointIds.filter((x) => x !== id)
        : [...prev.selectedEndpointIds, id],
    }));
  };

  const toggleFormCategory = (id) => {
    setProfileForm((prev) => ({
      ...prev,
      selectedCategoryIds: prev.selectedCategoryIds.includes(id)
        ? prev.selectedCategoryIds.filter((x) => x !== id)
        : [...prev.selectedCategoryIds, id],
    }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setBanner(null);

    if (!profileForm.name.trim()) {
      setBanner({ type: 'error', title: 'Błąd walidacji', text: 'Podaj nazwę profilu.' });
      return;
    }
    if (profileForm.selectedEndpointIds.length === 0) {
      setBanner({
        type: 'error',
        title: 'Brak źródeł danych',
        text: 'Przypisz do profilu przynajmniej jeden endpoint.',
      });
      return;
    }
    if (profileForm.selectedCategoryIds.length === 0) {
      setBanner({
        type: 'error',
        title: 'Brak kategorii słów kluczowych',
        text: 'Przypisz do profilu przynajmniej jedną kategorię słów kluczowych.',
      });
      return;
    }

    const payload = {
      name: profileForm.name.trim(),
      enabled: profileForm.enabled,
      cronTime: profileForm.cronTime,
      matchMode: profileForm.matchMode,
      endpointIds: profileForm.selectedEndpointIds.join(','),
      categoryIds: profileForm.selectedCategoryIds.join(','),
      recipientEmails: profileForm.recipientEmails.trim(),
    };

    try {
      if (editingProfileId) {
        await api.put(`/automation/profiles/${editingProfileId}`, payload);
        setBanner({
          type: 'success',
          title: 'Zaktualizowano profil',
          text: `Zmiany w profilu "${payload.name}" zostały zapisane.`,
        });
      } else {
        await api.post('/automation/profiles', payload);
        setBanner({
          type: 'success',
          title: 'Utworzono nowy profil',
          text: `Profil "${payload.name}" został dodany do harmonogramu.`,
        });
      }
      resetProfileForm();
      fetchAll();
    } catch (err) {
      setBanner({
        type: 'error',
        title: 'Błąd zapisu profilu',
        text: err.response?.data?.message || 'Nie udało się zapisać profilu automatyzacji.',
      });
    }
  };

  const handleToggleProfileEnabled = async (profile) => {
    setBanner(null);
    try {
      await api.put(`/automation/profiles/${profile.id}`, {
        ...profile,
        enabled: !profile.enabled,
      });
      fetchAll();
    } catch {
      setBanner({
        type: 'error',
        title: 'Błąd zmiany statusu',
        text: 'Nie udało się przełączyć statusu profilu.',
      });
    }
  };

  const handleTriggerProfileNow = async (profile) => {
    setBanner(null);
    setLoadingAction(true);
    try {
      const res = await api.post(`/automation/profiles/${profile.id}/trigger`);
      await fetchAll();
      setBanner({
        type: 'success',
        title: `Wykonano profil: ${profile.name}`,
        text: `Pobrano: ${res.data.totalFetched}, Zapisano (>0 pkt): ${res.data.savedCount}, Wykluczono: ${res.data.excludedCount}.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        title: `Błąd uruchomienia profilu: ${profile.name}`,
        text: err.response?.data?.message || 'Wystąpił błąd podczas wykonywania profilu.',
      });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteProfile = async (id) => {
    if (!confirm('Czy na pewno chcesz usunąć ten profil automatyzacji?')) return;
    await api.delete(`/automation/profiles/${id}`);
    if (editingProfileId === id) resetProfileForm();
    fetchAll();
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    setBanner(null);
    try {
      await api.put('/automation/cron', smtp);
      setBanner({
        type: 'success',
        title: 'Zapisano ustawienia SMTP',
        text: 'Konfiguracja serwera pocztowego została zaktualizowana.',
      });
      setShowSmtpSettings(false);
    } catch {
      setBanner({
        type: 'error',
        title: 'Błąd zapisu SMTP',
        text: 'Nie udało się zapisać konfiguracji SMTP.',
      });
    }
  };

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
        text: `Wygenerowano arkusz (${res.data.filename}) zawierający ${res.data.count} przetargów.`,
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
        downloadBase64Excel(res.data.base64, res.data.filename || 'raport_przetargi.xlsx');
      }
      setBanner({
        type: res.data.sent ? 'success' : 'error',
        title: res.data.sent
          ? 'Wysłano raport Excel na e-mail'
          : 'Wygenerowano plik Excel (Brak konfiguracji SMTP)',
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-black">
            Profile Automatyzacji (Cron) i Eksport Excel
          </h2>
          <p className="text-sm font-medium text-black mt-1">
            Twórz dedykowane profile (np. dla firmy IT, budowlanej) z własnymi endpointami, kategoriami i harmonogramem.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSmtpSettings(!showSmtpSettings)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-white border-2 border-blue-600 hover:bg-blue-50 rounded-xl text-xs font-extrabold cursor-pointer"
        >
          <Settings size={16} />
          Konfiguracja serwera pocztowego SMTP
        </button>
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

      {/* Rozwijany panel konfiguracji SMTP */}
      {showSmtpSettings && (
        <form
          onSubmit={handleSaveSmtp}
          className="bg-white p-5 rounded-xl border-2 border-blue-600 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-blue-100 pb-2">
            <h3 className="font-extrabold text-sm uppercase text-blue-700">
              Ustawienia serwera wysyłki poczty (SMTP)
            </h3>
            <button
              type="button"
              onClick={() => setShowSmtpSettings(false)}
              className="p-1 rounded hover:bg-blue-50 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Host SMTP</label>
              <input
                type="text"
                value={smtp.smtpHost}
                onChange={(e) => setSmtp({ ...smtp, smtpHost: e.target.value })}
                placeholder="np. smtp.gmail.com"
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Port SMTP</label>
              <input
                type="number"
                value={smtp.smtpPort}
                onChange={(e) => setSmtp({ ...smtp, smtpPort: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Login / E-mail nadawcy</label>
              <input
                type="text"
                value={smtp.smtpUsername}
                onChange={(e) => setSmtp({ ...smtp, smtpUsername: e.target.value })}
                placeholder="twoj@email.pl"
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Hasło aplikacji</label>
              <input
                type="password"
                value={smtp.smtpPassword}
                onChange={(e) => setSmtp({ ...smtp, smtpPassword: e.target.value })}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-xs cursor-pointer"
            >
              <Save size={14} /> Zapisz SMTP
            </button>
          </div>
        </form>
      )}

      {/* SEKCJA 1: KREATOR I OBSŁUGA PROFILI AUTOMATYZACJI */}
      <div className="bg-white p-6 rounded-xl border-2 border-blue-600 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-blue-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Layers size={22} className="text-blue-600" />
            <div>
              <h3 className="text-lg font-extrabold text-black">
                1. Kreator i Obsługa Profili Automatyzacji (Cron)
              </h3>
              <p className="text-xs font-semibold text-black">
                Każdy profil posiada własną nazwę, przypisane endpointy, kategorie, tryb dopasowania, godzinę Crona i odbiorców e-mail.
              </p>
            </div>
          </div>

          {editingProfileId && (
            <button
              type="button"
              onClick={resetProfileForm}
              className="px-3.5 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 rounded-lg text-xs font-bold cursor-pointer"
            >
              Anuluj edycję
            </button>
          )}
        </div>

        {/* Formularz kreatora profilu */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-slate-50 p-5 rounded-xl border border-blue-200 space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3">
              <label className="block text-xs font-bold uppercase mb-1">Nazwa profilu</label>
              <input
                type="text"
                required
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                placeholder="np. Firma Informatyczna, Budowlanka"
                className="w-full px-3.5 py-2 border border-blue-300 rounded-lg bg-white text-black font-bold"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase mb-1">Godzina Crona</label>
              <input
                type="time"
                value={profileForm.cronTime}
                onChange={(e) => setProfileForm({ ...profileForm, cronTime: e.target.value })}
                className="w-full px-3.5 py-2 border border-blue-300 rounded-lg bg-white text-black font-bold"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold uppercase mb-1">Warunek dopasowania</label>
              <select
                value={profileForm.matchMode}
                onChange={(e) => setProfileForm({ ...profileForm, matchMode: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-black font-semibold text-xs"
              >
                <option value="ANY">Chociaż 1 słowo z kategorii (OR)</option>
                <option value="ALL">Wszystkie słowa z kategorii (AND)</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-bold uppercase mb-1">
                E-maile dla profilu (auto-wysyłka Excela)
              </label>
              <input
                type="text"
                value={profileForm.recipientEmails}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, recipientEmails: e.target.value })
                }
                placeholder="np. it@firma.pl, zarzad@firma.pl"
                className="w-full px-3.5 py-2 border border-blue-300 rounded-lg bg-white text-black text-sm"
              />
            </div>
          </div>

          {/* Wybór Endpointów i Kategorii dla profilu */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-blue-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase flex items-center gap-1.5">
                  <Globe size={15} className="text-blue-600" />
                  Przypisz Endpointy ({profileForm.selectedEndpointIds.length})
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setProfileForm({
                        ...profileForm,
                        selectedEndpointIds: endpoints.map((e) => e.id),
                      })
                    }
                    className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer"
                  >
                    Wszystkie
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileForm({ ...profileForm, selectedEndpointIds: [] })}
                    className="text-[11px] font-bold text-black hover:underline cursor-pointer"
                  >
                    Wyczyść
                  </button>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {endpoints.length === 0 ? (
                  <p className="text-xs text-black">Brak dostępnych endpointów.</p>
                ) : (
                  endpoints.map((ep) => {
                    const checked = profileForm.selectedEndpointIds.includes(ep.id);
                    return (
                      <label
                        key={ep.id}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer ${
                          checked
                            ? 'bg-blue-50 border-blue-500 font-bold'
                            : 'bg-white border-blue-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFormEndpoint(ep.id)}
                            className="accent-blue-600 w-4 h-4"
                          />
                          <span className="truncate">{ep.name}</span>
                        </div>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 bg-blue-100 rounded">
                          {ep.httpMethod}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase flex items-center gap-1.5">
                  <KeyRound size={15} className="text-blue-600" />
                  Przypisz Kategorie Słów Kluczowych ({profileForm.selectedCategoryIds.length})
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setProfileForm({
                        ...profileForm,
                        selectedCategoryIds: categories.map((c) => c.id),
                      })
                    }
                    className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer"
                  >
                    Wszystkie
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileForm({ ...profileForm, selectedCategoryIds: [] })}
                    className="text-[11px] font-bold text-black hover:underline cursor-pointer"
                  >
                    Wyczyść
                  </button>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {categories.length === 0 ? (
                  <p className="text-xs text-black">Brak zdefiniowanych kategorii.</p>
                ) : (
                  categories.map((cat) => {
                    const checked = profileForm.selectedCategoryIds.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer ${
                          checked
                            ? 'bg-blue-50 border-blue-500 font-bold'
                            : 'bg-white border-blue-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFormCategory(cat.id)}
                            className="accent-blue-600 w-4 h-4"
                          />
                          <span className="truncate">{cat.name}</span>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs font-extrabold cursor-pointer">
              <input
                type="checkbox"
                checked={profileForm.enabled}
                onChange={(e) => setProfileForm({ ...profileForm, enabled: e.target.checked })}
                className="w-4 h-4 accent-blue-600"
              />
              Harmonogram profilu aktywny od razu po zapisaniu
            </label>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs cursor-pointer"
            >
              {editingProfileId ? <Save size={15} /> : <Plus size={15} />}
              {editingProfileId ? 'Zapisz zmiany profilu' : 'Utwórz Profil Automatyzacji'}
            </button>
          </div>
        </form>

        {/* Tabela utworzonych profili */}
        <div className="rounded-xl border border-blue-200 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="p-3.5 font-bold">Profil</th>
                <th className="p-3.5 font-bold">Godzina Crona</th>
                <th className="p-3.5 font-bold">Przypisane Endpointy i Kategorie</th>
                <th className="p-3.5 font-bold">Odbiorcy E-mail</th>
                <th className="p-3.5 font-bold">Status (Kliknij)</th>
                <th className="p-3.5 font-bold text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center font-medium text-black">
                    Brak utworzonych profili. Stwórz pierwszy profil powyżej (np. dla branży IT lub budowlanej).
                  </td>
                </tr>
              ) : (
                profiles.map((p) => {
                  const epIds = parseIdList(p.endpointIds);
                  const catIds = parseIdList(p.categoryIds);
                  const epNames = endpoints
                    .filter((e) => epIds.includes(e.id))
                    .map((e) => e.name);
                  const catNames = categories
                    .filter((c) => catIds.includes(c.id))
                    .map((c) => c.name);

                  return (
                    <tr key={p.id} className="hover:bg-blue-50/40">
                      <td className="p-3.5 align-top">
                        <div className="font-extrabold text-black text-base">{p.name}</div>
                        <div className="text-[11px] font-semibold text-black mt-0.5">
                          Dopasowanie: {p.matchMode === 'ALL' ? 'Wszystkie słowa (AND)' : 'Min. 1 słowo (OR)'}
                        </div>
                        {p.lastRunAt && (
                          <div className="text-[11px] text-blue-800 font-semibold mt-1">
                            Ostatnio: {new Date(p.lastRunAt).toLocaleString('pl-PL')} ({p.lastRunStatus})
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 font-mono font-extrabold text-base align-top">
                        {p.cronTime}
                      </td>

                      <td className="p-3.5 align-top space-y-1.5 text-xs">
                        <div>
                          <span className="font-extrabold">Endpointy ({epNames.length}): </span>
                          <span>{epNames.join(', ') || 'Brak'}</span>
                        </div>
                        <div>
                          <span className="font-extrabold">Kategorie ({catNames.length}): </span>
                          <span>{catNames.join(', ') || 'Brak'}</span>
                        </div>
                      </td>

                      <td className="p-3.5 text-xs font-mono align-top">
                        {p.recipientEmails || '—'}
                      </td>

                      <td className="p-3.5 align-top">
                        <button
                          type="button"
                          onClick={() => handleToggleProfileEnabled(p)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold border-2 transition cursor-pointer ${
                            p.enabled
                              ? 'bg-green-400 hover:bg-green-500 border-green-800 text-black'
                              : 'bg-red-400 hover:bg-red-500 border-red-800 text-black'
                          }`}
                        >
                          {p.enabled ? 'AKTYWNY' : 'WYŁĄCZONY'}
                        </button>
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap align-top">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={loadingAction}
                            onClick={() => handleTriggerProfileNow(p)}
                            title="Uruchom pobieranie dla tego profilu teraz"
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 border-2 border-amber-500 text-black rounded-lg font-extrabold text-xs cursor-pointer"
                          >
                            <Play size={13} /> Uruchom
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditProfile(p)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                          >
                            <Pencil size={13} /> Edytuj
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProfile(p.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-400 hover:bg-red-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                          >
                            <Trash2 size={13} /> Usuń
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                Kolumna Tryb wskazuje czy pobranie było ręczne, czy z harmonogramu konkretnego profilu: Cron [nazwa profilu].
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
                    Brak zarejestrowanych pobrań. Uruchom pobieranie w Wyszukiwarce lub kliknij „Uruchom” przy wybranym profilu powyżej.
                  </td>
                </tr>
              ) : (
                runs.map((r) => {
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