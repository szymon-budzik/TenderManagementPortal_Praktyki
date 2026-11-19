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
  HelpCircle,
} from 'lucide-react';

function parseIdList(str) {
  if (!str) return [];
  return str
    .split(',')
    .map((s) => Number(s.split(':')[0].trim()))
    .filter((n) => !Number.isNaN(n) && n > 0);
}

function parseCategoryModesMap(str, fallbackMode = 'OR') {
  const def = fallbackMode === 'ALL' || fallbackMode === 'AND' ? 'AND' : 'OR';
  const map = {};
  if (!str) return map;
  str.split(',').forEach((part) => {
    const pieces = part.trim().split(':');
    const id = Number(pieces[0]?.trim());
    if (!Number.isNaN(id) && id > 0) {
      const m = pieces[1]?.trim().toUpperCase();
      map[id] = m === 'AND' || m === 'ALL' ? 'AND' : m === 'OR' || m === 'ANY' ? 'OR' : def;
    }
  });
  return map;
}

function parseEmailTags(raw) {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter(Boolean);
}

function parseScheduleTags(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const DAY_NAMES = {
  1: 'Pon',
  2: 'Wt',
  3: 'Śr',
  4: 'Czw',
  5: 'Pt',
  6: 'Sob',
  7: 'Nd',
};

function formatSingleScheduleTag(token) {
  const parts = token.split('/');
  const rawTime = (parts[0] || '').trim();
  const hm = rawTime.split(':');
  const normTime =
    hm.length === 2
      ? `${hm[0].trim().padStart(2, '0')}:${hm[1].trim().padStart(2, '0')}`
      : rawTime;

  if (parts.length === 1 || !parts[1].trim()) {
    return `${normTime} (Codziennie)`;
  }
  const days = parts[1]
    .split(';')
    .map((d) => DAY_NAMES[Number(d.trim())] || d.trim())
    .filter(Boolean)
    .join(', ');
  return `${normTime} (${days})`;
}

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
    scheduleType: 'SCHEDULE', // 'SCHEDULE' | 'INTERVAL'
    cronTime: '8:00, 16:00',
    intervalMinutes: 60,
    selectedEndpointIds: [],
    selectedCategoryIds: [],
    categoryModes: {}, // { [catId]: 'OR' | 'AND' }
    recipientEmails: '',
    smtpAccountId: '', // '' = Brak SMTP
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
        // Ciche odświeżanie w tle co 10s
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const resetProfileForm = () => {
    setEditingProfileId(null);
    setProfileForm({
      name: '',
      enabled: true,
      scheduleType: 'SCHEDULE',
      cronTime: '8:00, 16:00',
      intervalMinutes: 60,
      selectedEndpointIds: [],
      selectedCategoryIds: [],
      categoryModes: {},
      recipientEmails: '',
      smtpAccountId: '',
    });
  };

  const handleStartEditProfile = (p) => {
    setEditingProfileId(p.id);
    const isInterval = (p.scheduleType || '').toUpperCase() === 'INTERVAL';
    setProfileForm({
      name: p.name || '',
      enabled: Boolean(p.enabled),
      scheduleType: isInterval ? 'INTERVAL' : 'SCHEDULE',
      cronTime: p.cronTime || '8:00',
      intervalMinutes: p.intervalMinutes || 60,
      selectedEndpointIds: parseIdList(p.endpointIds),
      selectedCategoryIds: parseIdList(p.categoryIds),
      categoryModes: parseCategoryModesMap(p.categoryIds, p.matchMode),
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

  const toggleFormCategoryMode = (e, catId) => {
    e.preventDefault();
    e.stopPropagation();
    setProfileForm((prev) => ({
      ...prev,
      categoryModes: {
        ...prev.categoryModes,
        [catId]: prev.categoryModes[catId] === 'AND' ? 'OR' : 'AND',
      },
    }));
  };

  const removeScheduleTag = (indexToRemove) => {
    const tags = parseScheduleTags(profileForm.cronTime);
    const next = tags.filter((_, idx) => idx !== indexToRemove).join(', ');
    setProfileForm({ ...profileForm, cronTime: next });
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

    const serializedCategories = profileForm.selectedCategoryIds
      .map((id) => `${id}:${profileForm.categoryModes[id] || 'OR'}`)
      .join(',');

    const hasSmtp = Boolean(profileForm.smtpAccountId);

    const payload = {
      name: profileForm.name.trim(),
      enabled: profileForm.enabled,
      scheduleType: profileForm.scheduleType,
      cronTime: profileForm.cronTime.trim() || '8:00',
      intervalMinutes: Math.max(1, Number(profileForm.intervalMinutes) || 60),
      daysOfWeek: '',
      matchMode: 'OR',
      endpointIds: profileForm.selectedEndpointIds.join(','),
      categoryIds: serializedCategories,
      recipientEmails: hasSmtp ? profileForm.recipientEmails.trim() : '',
      smtpAccountId: hasSmtp ? Number(profileForm.smtpAccountId) : null,
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

  const scheduleTags = parseScheduleTags(profileForm.cronTime);
  const profileEmailTags = parseEmailTags(profileForm.recipientEmails);
  const isNoSmtpSelected = !profileForm.smtpAccountId;

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
          Twórz dedykowane profile (np. dla firmy IT, budowlanej) z własnymi endpointami, kategoriami (OR/AND), harmonogramem i opcjonalnym kontem SMTP.
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl border-2 border-blue-600 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-blue-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Layers size={22} className="text-blue-600" />
            <div>
              <h3 className="text-lg font-extrabold text-black">
                Kreator i Obsługa Profili Automatyzacji (Cron)
              </h3>
              <p className="text-xs font-semibold text-black">
                Wybierz tryb harmonogramu, konto SMTP (lub Brak SMTP) oraz przypisz endpointy i kategorie.
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
          {/* Wiersz 1: Nazwa profilu, 2 tryby Crona, Konto SMTP */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-4">
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

            <div className="md:col-span-4">
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
                <option value="SCHEDULE">Harmonogram (godziny / dni tygodnia)</option>
                <option value="INTERVAL">Interwał czasowy (co X minut)</option>
              </select>
            </div>

            <div className="md:col-span-4">
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
                <option value="">Brak SMTP</option>
                {smtpAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.smtpUsername || acc.username})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Wiersz 2: Parametry czasu Crona (z ikonką "?" i szarymi tagami) + E-maile */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-white p-4 rounded-xl border border-blue-200">
            <div className="md:col-span-6 space-y-2">
              {profileForm.scheduleType === 'INTERVAL' ? (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase text-blue-700 mb-1.5">
                    <Clock size={15} />
                    Uruchamiaj cyklicznie co (liczba minut):
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      required
                      value={profileForm.intervalMinutes}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          intervalMinutes:
                            e.target.value === '' ? '' : Math.max(1, Number(e.target.value)),
                        })
                      }
                      placeholder="np. 15"
                      className="w-36 px-3.5 py-2 border border-blue-300 rounded-lg bg-white text-black font-bold text-sm"
                    />
                    <span className="text-xs font-extrabold text-black">minut</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock size={15} className="text-blue-700" />
                    <label className="text-xs font-extrabold uppercase text-blue-700">
                      Harmonogram (godziny i opcjonalnie dni tygodnia)
                    </label>

                    {/* Ikonka "?" z chmurką wyjaśniającą składnię po najechaniu */}
                    <div className="relative group inline-flex items-center">
                      <HelpCircle
                        size={16}
                        className="text-blue-600 hover:text-blue-800 cursor-help"
                      />
                      <div className="hidden group-hover:block absolute left-0 top-6 z-40 w-80 p-3.5 bg-slate-900 text-white text-xs rounded-xl shadow-xl border border-blue-400 space-y-1.5 leading-relaxed">
                        <div className="font-extrabold text-blue-300 uppercase text-[11px]">
                          Jak wpisywać harmonogram?
                        </div>
                        <div>
                          <span className="font-mono font-bold text-amber-300">8:00, 16:00</span> — codziennie o 08:00 i 16:00
                        </div>
                        <div>
                          <span className="font-mono font-bold text-amber-300">8:00/1</span> — w każdy poniedziałek o 08:00
                        </div>
                        <div>
                          <span className="font-mono font-bold text-amber-300">16:00/2;5</span> — we wtorki i piątki o 16:00
                        </div>
                        <div className="pt-1 border-t border-slate-700 text-[11px] text-slate-300">
                          Dni tygodnia: <b>1</b> Pon, <b>2</b> Wt, <b>3</b> Śr, <b>4</b> Czw, <b>5</b> Pt, <b>6</b> Sob, <b>7</b> Nd. Reguły rozdzielaj przecinkiem.
                        </div>
                      </div>
                    </div>
                  </div>

                  <input
                    type="text"
                    required
                    value={profileForm.cronTime}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, cronTime: e.target.value })
                    }
                    placeholder="np. 8:00, 16:00 lub 8:00/1, 16:00/2;5"
                    className="w-full px-3.5 py-2 border border-blue-300 rounded-lg bg-white text-black font-mono text-sm"
                  />

                  {scheduleTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {scheduleTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-200 border border-slate-400 rounded-md text-xs font-bold text-black"
                        >
                          <Clock size={12} className="text-slate-700" />
                          {formatSingleScheduleTag(tag)}
                          <button
                            type="button"
                            onClick={() => removeScheduleTag(idx)}
                            className="hover:text-red-700 font-extrabold cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Odbiorcy e-mail: zaciemnione gdy Brak SMTP, opcjonalne gdy wybrane SMTP */}
            <div className="md:col-span-6">
              <label
                className={`block text-xs font-bold uppercase mb-1 ${
                  isNoSmtpSelected ? 'text-slate-400' : 'text-black'
                }`}
              >
                Odbiorcy e-mail (opcjonalnie, rozdzielaj przecinkiem)
              </label>
              <input
                type="text"
                disabled={isNoSmtpSelected}
                value={isNoSmtpSelected ? '' : profileForm.recipientEmails}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, recipientEmails: e.target.value })
                }
                placeholder={
                  isNoSmtpSelected
                    ? 'Wybrano Brak SMTP — wysyłka e-mail wyłączona'
                    : 'np. biuro@firma.pl, przetargi@firma.pl (może zostać puste)'
                }
                className={`w-full px-3.5 py-2 border rounded-lg text-sm font-mono transition ${
                  isNoSmtpSelected
                    ? 'bg-slate-200 border-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-white border-blue-300 text-black'
                }`}
              />
              {!isNoSmtpSelected && profileEmailTags.length > 0 && (
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

          {/* Wiersz 3: Wybór Endpointów i Kategorii (z przyciskiem OR/AND na prostokącie kategorii) */}
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

              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
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
                  Przypisz Kategorie ({profileForm.selectedCategoryIds.length}) — kliknij OR/AND
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

              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {categories.length === 0 ? (
                  <p className="text-xs text-black">Brak zdefiniowanych kategorii.</p>
                ) : (
                  categories.map((cat) => {
                    const checked = profileForm.selectedCategoryIds.includes(cat.id);
                    const mode = profileForm.categoryModes[cat.id] || 'OR';
                    return (
                      <label
                        key={cat.id}
                        className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
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

                        <button
                          type="button"
                          onClick={(e) => toggleFormCategoryMode(e, cat.id)}
                          title={
                            mode === 'AND'
                              ? 'AND: Wszystkie słowa z kategorii (kliknij, aby zmienić na OR)'
                              : 'OR: Min. 1 słowo z kategorii (kliknij, aby zmienić na AND)'
                          }
                          className={`px-2 py-0.5 rounded text-[11px] font-extrabold border-2 transition cursor-pointer shrink-0 ${
                            mode === 'AND'
                              ? 'bg-purple-200 hover:bg-purple-300 border-purple-700 text-black'
                              : 'bg-blue-100 hover:bg-blue-200 border-blue-600 text-black'
                          }`}
                        >
                          {mode}
                        </button>
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
                  const catModesMap = parseCategoryModesMap(p.categoryIds, p.matchMode);
                  const catIds = Object.keys(catModesMap).map(Number);

                  const epNames = endpoints
                    .filter((e) => epIds.includes(e.id))
                    .map((e) => e.name);
                  const catLabels = categories
                    .filter((c) => catIds.includes(c.id))
                    .map((c) => `${c.name} (${catModesMap[c.id] || 'OR'})`);

                  const assignedSmtp = p.smtpAccountId
                    ? smtpAccounts.find((s) => Number(s.id) === Number(p.smtpAccountId))
                    : null;
                  const emailTags = parseEmailTags(p.recipientEmails);
                  const isInterval = (p.scheduleType || '').toUpperCase() === 'INTERVAL';
                  const rowScheduleTags = parseScheduleTags(p.cronTime);

                  return (
                    <tr key={p.id} className="hover:bg-blue-50/40">
                      <td className="p-3.5 align-top">
                        <div className="font-extrabold text-black text-base">{p.name}</div>
                        {p.lastRunAt && (
                          <div className="text-[11px] text-blue-800 font-semibold mt-1">
                            Ostatnio: {new Date(p.lastRunAt).toLocaleString('pl-PL')} ({p.lastRunStatus})
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 align-top">
                        {isInterval ? (
                          <span className="px-2.5 py-1 bg-slate-200 border border-slate-400 rounded-md text-xs font-extrabold inline-block">
                            Co {p.intervalMinutes || 60} min
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {rowScheduleTags.map((t, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-slate-200 border border-slate-400 rounded text-[11px] font-bold text-black"
                              >
                                {formatSingleScheduleTag(t)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 align-top space-y-1.5 text-xs">
                        <div>
                          <span className="font-extrabold">Endpointy ({epNames.length}): </span>
                          <span>{epNames.join(', ') || 'Brak'}</span>
                        </div>
                        <div>
                          <span className="font-extrabold">Kategorie ({catLabels.length}): </span>
                          <span>{catLabels.join(', ') || 'Brak'}</span>
                        </div>
                      </td>

                      <td className="p-3.5 text-xs align-top space-y-1.5">
                        <div className="text-[11px] font-extrabold text-blue-800">
                          SMTP: {assignedSmtp ? assignedSmtp.name : 'Brak SMTP'}
                        </div>
                        {assignedSmtp && emailTags.length > 0 ? (
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
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="p-3.5 align-top">
                        <button
                          type="button"
                          onClick={() => handleToggleProfileEnabled(p)}
                          className={`w-28 text-center py-1.5 rounded-lg text-xs font-extrabold border-2 transition cursor-pointer ${
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