import {
  Mail,
  Save,
  Plus,
  Globe,
  KeyRound,
  Clock,
  HelpCircle,
  Bell,
  ListChecks,
  Code2,
} from 'lucide-react';
import CategoryQueryEditor from '../common/CategoryQueryEditor';
import {
  formatSingleScheduleTag,
  parseEmailTags,
  parseScheduleTags,
} from './automationUtils';

export default function AutomationProfileForm({
  profileForm,
  setProfileForm,
  editingProfileId,
  endpoints,
  categories,
  smtpAccounts,
  onSubmit,
}) {
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

  const scheduleTags = parseScheduleTags(profileForm.cronTime);
  const profileEmailTags = parseEmailTags(profileForm.recipientEmails);
  const isNoSmtpSelected = !profileForm.smtpAccountId;

  return (
    <form
      onSubmit={onSubmit}
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
            onChange={(e) => setProfileForm({ ...profileForm, scheduleType: e.target.value })}
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
            onChange={(e) => setProfileForm({ ...profileForm, smtpAccountId: e.target.value })}
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

      {/* Wiersz 2: Parametry czasu Crona + E-maile */}
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
                onChange={(e) => setProfileForm({ ...profileForm, cronTime: e.target.value })}
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
            onChange={(e) => setProfileForm({ ...profileForm, recipientEmails: e.target.value })}
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

      {/* Wiersz 3: Wybór Endpointów i Kategorii */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-blue-200 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
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
                    selectedEndpointIds: endpoints.filter((e) => e.isActive).map((e) => e.id),
                  })
                }
                className="text-[11px] font-bold text-green-700 hover:underline cursor-pointer"
              >
                Tylko aktywne
              </button>
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
                const isInactive = !ep.isActive;
                return (
                  <label
                    key={ep.id}
                    className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                      isInactive
                        ? checked
                          ? 'bg-red-50 border-red-500 font-bold'
                          : 'bg-slate-100 border-red-200 opacity-75 hover:bg-red-50/40'
                        : checked
                        ? 'bg-blue-50 border-blue-500 font-bold'
                        : 'bg-white border-blue-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFormEndpoint(ep.id)}
                        className="accent-blue-600 w-4 h-4 shrink-0"
                      />
                      <span className={`truncate ${isInactive ? 'line-through text-slate-600' : ''}`}>
                        {ep.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${
                          ep.isActive
                            ? 'bg-green-300 border-green-700 text-black'
                            : 'bg-red-300 border-red-700 text-black'
                        }`}
                      >
                        {ep.isActive ? 'AKTYWNY' : 'WYŁĄCZONY'}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 bg-blue-100 rounded">
                        {ep.httpMethod}
                      </span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold uppercase flex items-center gap-1.5">
              <KeyRound size={15} className="text-blue-600" />
              {profileForm.useCategoryQuery
                ? 'Zapytanie Kategorii'
                : `Przypisz Kategorie (${profileForm.selectedCategoryIds.length}) — kliknij OR/AND`}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md border border-blue-500 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setProfileForm({ ...profileForm, useCategoryQuery: false })}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-extrabold cursor-pointer transition ${
                    !profileForm.useCategoryQuery
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-black hover:bg-blue-50'
                  }`}
                >
                  <ListChecks size={12} /> Lista
                </button>
                <button
                  type="button"
                  onClick={() => setProfileForm({ ...profileForm, useCategoryQuery: true })}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-extrabold cursor-pointer transition ${
                    profileForm.useCategoryQuery
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-black hover:bg-blue-50'
                  }`}
                >
                  <Code2 size={12} /> Zapytanie
                </button>
              </div>

              {!profileForm.useCategoryQuery && (
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
              )}
            </div>
          </div>

          {profileForm.useCategoryQuery ? (
            <CategoryQueryEditor
              value={profileForm.categoryQuery || ''}
              onChange={(nextQuery) =>
                setProfileForm({ ...profileForm, categoryQuery: nextQuery })
              }
              categories={categories}
              compact={true}
            />
          ) : (
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
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-xs font-extrabold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={profileForm.enabled}
              onChange={(e) => setProfileForm({ ...profileForm, enabled: e.target.checked })}
              className="w-4 h-4 accent-blue-600 cursor-pointer"
            />
            Harmonogram profilu aktywny od razu po zapisaniu
          </label>

          <label className="flex items-center gap-2 text-xs font-extrabold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={profileForm.notificationsEnabled}
              onChange={(e) =>
                setProfileForm({ ...profileForm, notificationsEnabled: e.target.checked })
              }
              className="w-4 h-4 accent-blue-600 cursor-pointer"
            />
            <Bell size={14} className="text-blue-600" />
            Powiadomienia z tego profilu
          </label>
        </div>

        <button
          type="submit"
          className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs cursor-pointer"
        >
          {editingProfileId ? <Save size={15} /> : <Plus size={15} />}
          {editingProfileId ? 'Zapisz zmiany profilu' : 'Utwórz Profil Automatyzacji'}
        </button>
      </div>
    </form>
  );
}
