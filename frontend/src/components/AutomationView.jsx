import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import {
  Mail,
  Play,
  Save,
  Trash2,
  Plus,
  Pencil,
  Layers,
  Globe,
  KeyRound,
  ArrowUpDown,
  Clock,
} from 'lucide-react';

function parseIdList(str) {
  if (!str) return [];
  return str
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n) && n > 0);
}

function parseEmailTags(raw) {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter(Boolean);
}

const DAYS_OF_WEEK = [
  { id: '1', label: 'Pon' },
  { id: '2', label: 'Wt' },
  { id: '3', label: 'Śr' },
  { id: '4', label: 'Czw' },
  { id: '5', label: 'Pt' },
  { id: '6', label: 'Sob' },
  { id: '7', label: 'Nd' },
];

export default function AutomationView() {
  const [profiles, setProfiles] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [smtpAccounts, setSmtpAccounts] = useState([]);
  const [loadingAction, setLoadingAction] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState(null);

  const [editingProfileId, setEditingProfileId] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    enabled: true,
    scheduleType: 'DAILY',
    cronTime: '08:00',
    intervalMinutes: 60,
    daysOfWeek: ['1', '2', '3', '4', '5'],
    matchMode: 'ANY',
    selectedEndpointIds: [],
    selectedCategoryIds: [],
    recipientEmails: '',
    smtpAccountId: '',
  });

  const [profileSort, setProfileSort] = useState({ key: 'id', dir: 'asc' });

  const fetchAll = async () => {
    try {
      const [profRes, smtpRes, epRes, catRes] = await Promise.all([
        api.get('/automation/profiles').catch(() => ({ data: [] })),
        api.get('/automation/smtp-accounts').catch(() => ({ data: [] })),
        api.get('/search/sources').catch(() => ({ data: [] })),
        api.get('/keywords').catch(() => ({ data: [] })),
      ]);

      setProfiles(profRes.data || []);
      setSmtpAccounts(smtpRes.data || []);
      setEndpoints(epRes.data || []);
      setCategories(catRes.data || []);
    } catch (err) {
      console.error('Błąd pobierania danych profili automatyzacji:', err);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(async () => {
      try {
        const profRes = await api.get('/automation/profiles');
        setProfiles(profRes.data || []);
      } catch {
        // Ciche odświeżanie statusu profili w tle co 10s
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const resetProfileForm = () => {
    setEditingProfileId(null);
    setProfileForm({
      name: '',
      enabled: true,
      scheduleType: 'DAILY',
      cronTime: '08:00',
      intervalMinutes: 60,
      daysOfWeek: ['1', '2', '3', '4', '5'],
      matchMode: 'ANY',
      selectedEndpointIds: [],
      selectedCategoryIds: [],
      recipientEmails: '',
      smtpAccountId: smtpAccounts[0]?.id ? String(smtpAccounts[0].id) : '',
    });
  };

  const handleStartEditProfile = (p) => {
    setEditingProfileId(p.id);
    const days = p.daysOfWeek
      ? p.daysOfWeek.split(',').map((d) => d.trim()).filter(Boolean)
      : ['1', '2', '3', '4', '5'];

    setProfileForm({
      name: p.name || '',
      enabled: Boolean(p.enabled),
      scheduleType: p.scheduleType || 'DAILY',
      cronTime: p.cronTime || '08:00',
      intervalMinutes: p.intervalMinutes || 60,
      daysOfWeek: days,
      matchMode: p.matchMode || 'ANY',
      selectedEndpointIds: parseIdList(p.endpointIds),
      selectedCategoryIds: parseIdList(p.categoryIds),
      recipientEmails: p.recipientEmails || '',
      smtpAccountId: p.smtpAccountId ? String(p.smtpAccountId) : '',
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

  const toggleDayOfWeek = (dayId) => {
    setProfileForm((prev) => {
      const exists = prev.daysOfWeek.includes(dayId);
      const next = exists
        ? prev.daysOfWeek.filter((d) => d !== dayId)
        : [...prev.daysOfWeek, dayId];
      return { ...prev, daysOfWeek: next.length > 0 ? next : ['1'] };
    });
  };

  const removeProfileEmailTag = (indexToRemove) => {
    const tags = parseEmailTags(profileForm.recipientEmails);
    const next = tags.filter((_, idx) => idx !== indexToRemove).join(', ');
    setProfileForm({ ...profileForm, recipientEmails: next });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (
      !profileForm.name.trim() ||
      profileForm.selectedEndpointIds.length === 0 ||
      profileForm.selectedCategoryIds.length === 0
    ) {
      return;
    }

    const payload = {
      name: profileForm.name.trim(),
      enabled: profileForm.enabled,
      scheduleType: profileForm.scheduleType,
      cronTime: profileForm.cronTime.trim() || '08:00',
      intervalMinutes: Number(profileForm.intervalMinutes) || 60,
      daysOfWeek: profileForm.daysOfWeek.join(','),
      matchMode: profileForm.matchMode,
      endpointIds: profileForm.selectedEndpointIds.join(','),
      categoryIds: profileForm.selectedCategoryIds.join(','),
      recipientEmails: profileForm.recipientEmails.trim(),
      smtpAccountId: profileForm.smtpAccountId ? Number(profileForm.smtpAccountId) : null,
    };

    try {
      if (editingProfileId) {
        await api.put(`/automation/profiles/${editingProfileId}`, payload);
      } else {
        await api.post('/automation/profiles', payload);
      }
      resetProfileForm();
      fetchAll();
    } catch (err) {
      console.error('Błąd zapisu profilu:', err);
    }
  };

  const handleToggleProfileEnabled = async (profile) => {
    try {
      await api.put(`/automation/profiles/${profile.id}`, {
        ...profile,
        enabled: !profile.enabled,
      });
      fetchAll();
    } catch (err) {
      console.error('Błąd zmiany statusu profilu:', err);
    }
  };

  const handleTriggerProfileNow = async (profile) => {
    setLoadingAction(true);
    try {
      await api.post(`/automation/profiles/${profile.id}/trigger`);
      await fetchAll();
    } catch (err) {
      console.error('Błąd uruchamiania profilu:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const confirmDeleteProfile = (profile) => {
    setConfirmDialog({
      title: 'Usuń profil automatyzacji',
      message: `Czy na pewno chcesz usunąć profil "${profile.name}"?`,
      onConfirm: async () => {
        try {
          await api.delete(`/automation/profiles/${profile.id}`);
          if (editingProfileId === profile.id) resetProfileForm();
          fetchAll();
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const formatScheduleDescription = (p) => {
    const type = p.scheduleType || 'DAILY';
    if (type === 'INTERVAL') {
      return `Co ${p.intervalMinutes || 60} min`;
    }
    if (type === 'MULTI_TIME') {
      return `Godziny: ${p.cronTime}`;
    }
    if (type === 'WEEKLY') {
      const dayLabels = (p.daysOfWeek || '1,2,3,4,5')
        .split(',')
        .map((id) => DAYS_OF_WEEK.find((d) => d.id === id.trim())?.label || id)
        .join(', ');
      return `${dayLabels} o ${p.cronTime}`;
    }
    return `Codziennie o ${p.cronTime}`;
  };

  const toggleSort = (key) => {
    setProfileSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedProfiles = useMemo(() => {
    const copy = [...profiles];
    copy.sort((a, b) => {
      const { key, dir } = profileSort;
      const mult = dir === 'asc' ? 1 : -1;
      const valA = a[key] ?? '';
      const valB = b[key] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * mult;
      }
      if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        return (valA === valB ? 0 : valA ? -1 : 1) * mult;
      }
      return String(valA).localeCompare(String(valB), 'pl') * mult;
    });
    return copy;
  }, [profiles, profileSort]);

  const profileEmailTags = parseEmailTags(profileForm.recipientEmails);

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
          Automatyzacja — Profile Harmonogramu (Cron)
        </h2>
        <p className="text-sm font-medium text-black mt-1">
          Twórz dedykowane profile (np. dla firmy IT, budowlanej) z własnymi endpointami, kategoriami, harmonogramem Crona i przypisanym kontem SMTP.
        </p>
      </div>

      {/* KREATOR I OBSŁUGA PROFILI AUTOMATYZACJI */}
      <div className="bg-white p-6 rounded-xl border-2 border-blue-600 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-blue-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Layers size={22} className="text-blue-600" />
            <div>
              <h3 className="text-lg font-extrabold text-black">
                Kreator i Obsługa Profili Automatyzacji (Cron)
              </h3>
              <p className="text-xs font-semibold text-black">
                Przypisz do profilu endpointy, kategorie, tryb aktywacji Crona, odbiorców e-mail oraz konto SMTP.
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

        <form
          onSubmit={handleSaveProfile}
          className="bg-slate-50 p-5 rounded-xl border border-blue-200 space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-3">
              <label className="block text-xs font-bold uppercase mb-1">Nazwa profilu</label>
              <input
                type="text"
                required
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                placeholder="np. Firma IT, Budowlanka"
                className="w-full px-3.5 py-2 border border-blue-300 rounded-lg bg-white text-black font-bold"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold uppercase mb-1">
                Tryb harmonogramu Crona
              </label>
              <select
                value={profileForm.scheduleType}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, scheduleType: e.target.value })
                }
                className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-black font-bold text-xs"
              >
                <option value="DAILY">Codziennie o wybranej godzinie</option>
                <option value="MULTI_TIME">Kilka razy dziennie (lista godzin)</option>
                <option value="INTERVAL">Interwał czasowy (co X minut)</option>
                <option value="WEEKLY">Wybrane dni tygodnia o godzinie</option>
              </select>
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

            <div className="md:col-span-3">
              <label className="block text-xs font-bold uppercase mb-1">
                Konto SMTP dla profilu
              </label>
              <select
                value={profileForm.smtpAccountId}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, smtpAccountId: e.target.value })
                }
                className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-black font-semibold text-xs"
              >
                <option value="">Domyślne konto SMTP</option>
                {smtpAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.smtpUsername || acc.username})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-white p-4 rounded-xl border border-blue-200">
            <div className="md:col-span-5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase text-blue-700">
                <Clock size={15} />
                Parametry czasu aktywacji Crona
              </div>

              {profileForm.scheduleType === 'DAILY' && (
                <div>
                  <label className="block text-xs font-bold mb-1">Godzina uruchomienia</label>
                  <input
                    type="time"
                    value={profileForm.cronTime.split(',')[0].trim() || '08:00'}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, cronTime: e.target.value })
                    }
                    className="px-3.5 py-2 border border-blue-300 rounded-lg bg-white text-black font-bold"
                  />
                </div>
              )}

              {profileForm.scheduleType === 'MULTI_TIME' && (
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Godziny uruchomienia (po przecinku, format HH:MM)
                  </label>
                  <input
                    type="text"
                    value={profileForm.cronTime}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, cronTime: e.target.value })
                    }
                    placeholder="np. 08:00, 12:30, 16:00"
                    className="w-full px-3.5 py-2 border border-blue-300 rounded-lg bg-white text-black font-mono text-xs font-bold"
                  />
                </div>
              )}

              {profileForm.scheduleType === 'INTERVAL' && (
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Uruchamiaj cyklicznie co:
                  </label>
                  <select
                    value={profileForm.intervalMinutes}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        intervalMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full px-3.5 py-2 border border-blue-300 rounded-lg bg-white text-black font-bold text-xs"
                  >
                    <option value={5}>Co 5 minut</option>
                    <option value={15}>Co 15 minut</option>
                    <option value={30}>Co 30 minut</option>
                    <option value={60}>Co 1 godzinę (60 min)</option>
                    <option value={120}>Co 2 godziny (120 min)</option>
                    <option value={240}>Co 4 godziny (240 min)</option>
                    <option value={360}>Co 6 godzin (360 min)</option>
                    <option value={720}>Co 12 godzin (720 min)</option>
                  </select>
                </div>
              )}

              {profileForm.scheduleType === 'WEEKLY' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_OF_WEEK.map((d) => {
                      const active = profileForm.daysOfWeek.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleDayOfWeek(d.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border cursor-pointer ${
                            active
                              ? 'bg-blue-600 border-blue-800 text-white'
                              : 'bg-slate-100 border-slate-300 text-black'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">Godzina:</span>
                    <input
                      type="time"
                      value={profileForm.cronTime.split(',')[0].trim() || '08:00'}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, cronTime: e.target.value })
                      }
                      className="px-3 py-1.5 border border-blue-300 rounded-lg bg-white text-black font-bold text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-7">
              <label className="block text-xs font-bold uppercase mb-1">
                Odbiorcy e-mail dla profilu (rozdzielaj przecinkiem)
              </label>
              <input
                type="text"
                value={profileForm.recipientEmails}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, recipientEmails: e.target.value })
                }
                placeholder="np. biuro@firma.pl, przetargi@firma.pl"
                className="w-full px-3.5 py-2 border border-blue-300 rounded-lg bg-white text-black text-sm font-mono"
              />
              {profileEmailTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profileEmailTags.map((email, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-200 border border-slate-400 rounded-md text-xs font-bold text-black"
                    >
                      <Mail size={12} className="text-slate-700" />
                      {email}
                      <button
                        type="button"
                        onClick={() => removeProfileEmailTag(idx)}
                        className="hover:text-red-700 font-extrabold cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

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

        <div className="rounded-xl border border-blue-200 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-blue-600 text-white select-none">
                <th
                  onClick={() => toggleSort('name')}
                  className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Profil <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('cronTime')}
                  className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Harmonogram Cron <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="p-3.5 font-bold">Przypisane Endpointy i Kategorie</th>
                <th
                  onClick={() => toggleSort('recipientEmails')}
                  className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Odbiorcy i Konto SMTP <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('enabled')}
                  className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Status <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="p-3.5 font-bold text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {sortedProfiles.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center font-medium text-black">
                    Brak utworzonych profili. Stwórz pierwszy profil powyżej.
                  </td>
                </tr>
              ) : (
                sortedProfiles.map((p) => {
                  const epIds = parseIdList(p.endpointIds);
                  const catIds = parseIdList(p.categoryIds);
                  const epNames = endpoints
                    .filter((e) => epIds.includes(e.id))
                    .map((e) => e.name);
                  const catNames = categories
                    .filter((c) => catIds.includes(c.id))
                    .map((c) => c.name);
                  const assignedSmtp = smtpAccounts.find(
                    (s) => Number(s.id) === Number(p.smtpAccountId)
                  );
                  const emailTags = parseEmailTags(p.recipientEmails);

                  return (
                    <tr key={p.id} className="hover:bg-blue-50/40">
                      <td className="p-3.5 align-top">
                        <div className="font-extrabold text-black text-base">{p.name}</div>
                        <div className="text-[11px] font-semibold text-black mt-0.5">
                          Dopasowanie:{' '}
                          {p.matchMode === 'ALL' ? 'Wszystkie słowa (AND)' : 'Min. 1 słowo (OR)'}
                        </div>
                        {p.lastRunAt && (
                          <div className="text-[11px] text-blue-800 font-semibold mt-1">
                            Ostatnio: {new Date(p.lastRunAt).toLocaleString('pl-PL')} ({p.lastRunStatus})
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 font-mono font-extrabold text-xs align-top">
                        <span className="px-2.5 py-1 bg-blue-50 border border-blue-300 rounded-md inline-block">
                          {formatScheduleDescription(p)}
                        </span>
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

                      <td className="p-3.5 text-xs align-top space-y-1.5">
                        <div className="text-[11px] font-extrabold text-blue-800">
                          SMTP: {assignedSmtp ? assignedSmtp.name : 'Domyślne'}
                        </div>
                        {emailTags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {emailTags.map((em, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-slate-200 border border-slate-400 rounded text-[11px] font-bold text-black"
                              >
                                {em}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span>—</span>
                        )}
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
                            onClick={() => confirmDeleteProfile(p)}
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
    </div>
  );
}