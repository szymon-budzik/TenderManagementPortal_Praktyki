import { useState, useEffect } from 'react';
import {
  getAiConfigs,
  createAiConfig,
  updateAiConfig,
  deleteAiConfig,
  fetchAiModels,
} from '../services/aiApi';
import ConfirmModal from './ConfirmModal';
import ResourceAccessModal from './ResourceAccessModal';
import { RESOURCE_TYPES, getResourceAccessSummary, removeResourceAccess } from '../rolesStore';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useSort } from '../hooks/useSort';
import {
  Bot,
  Plus,
  Save,
  Pencil,
  Trash2,
  RefreshCw,
  Plug,
  Shield,
  ArrowUpDown,
  X,
  CheckCircle2,
  AlertCircle,
  Star,
} from 'lucide-react';

const PROVIDERS = [
  {
    value: 'GEMINI',
    label: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
  },
  {
    value: 'OPENAI',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  {
    value: 'ANTHROPIC',
    label: 'Anthropic (Claude)',
    defaultBaseUrl: 'https://api.anthropic.com',
  },
  {
    value: 'OPENAI_COMPATIBLE',
    label: 'OpenAI-compatible (DeepSeek, OpenRouter, Groq, Mistral, Ollama)',
    defaultBaseUrl: '',
  },
];

const PROVIDER_LABELS = Object.fromEntries(PROVIDERS.map((p) => [p.value, p.label]));

const EMPTY_FORM = {
  name: '',
  provider: 'GEMINI',
  baseUrl: '',
  apiKey: '',
  defaultModel: '',
  active: true,
  isDefault: false,
};

export default function AiConfigView() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [models, setModels] = useState([]);
  const [manualModelMode, setManualModelMode] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);

  const [testingId, setTestingId] = useState(null);
  const [inspectedModelsModal, setInspectedModelsModal] = useState(null);
  const [modelSearch, setModelSearch] = useState('');
  const [accessModalConfig, setAccessModalConfig] = useState(null);
  const [, setAccessTick] = useState(0);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { confirmDialog, openConfirm, closeConfirm } = useConfirmDialog();
  const { toggleSort, sortedItems: sortedConfigs } = useSort(configs, { key: 'id', dir: 'asc' });

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const data = await getAiConfigs();
      setConfigs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Nie udało się pobrać listy konfiguracji AI.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getAiConfigs()
      .then((data) => {
        if (!cancelled) setConfigs(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Nie udało się pobrać listy konfiguracji AI.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentProviderMeta =
    PROVIDERS.find((p) => p.value === form.provider) || PROVIDERS[0];

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setModels([]);
    setManualModelMode(false);
  };

  const handleProviderChange = (nextProvider) => {
    setForm((prev) => ({ ...prev, provider: nextProvider }));
    setModels([]);
    setManualModelMode(false);
  };

  const handleEdit = (cfg) => {
    setError('');
    setSuccess('');
    setEditingId(cfg.id);
    setForm({
      name: cfg.name || '',
      provider: cfg.provider || 'GEMINI',
      baseUrl: cfg.baseUrl || '',
      apiKey: '',
      defaultModel: cfg.defaultModel || '',
      active: cfg.active ?? true,
      isDefault: cfg.isDefault ?? false,
    });
    setModels([]);
    setManualModelMode(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFetchModelsFromForm = async () => {
    setError('');
    setSuccess('');
    setFetchingModels(true);
    try {
      const list = await fetchAiModels({
        configId: editingId || null,
        provider: form.provider,
        baseUrl: form.baseUrl.trim() || null,
        apiKey: form.apiKey.trim() || null,
      });
      const safeList = Array.isArray(list) ? list : [];
      setModels(safeList);
      setManualModelMode(false);
      if (safeList.length > 0 && !form.defaultModel) {
        setForm((prev) => ({ ...prev, defaultModel: safeList[0].id }));
      }
      setSuccess(
        safeList.length > 0
          ? `Pobrano ${safeList.length} dostępnych modeli od dostawcy.`
          : 'Połączenie powiodło się, ale dostawca zwrócił pustą listę modeli.'
      );
    } catch (err) {
      setError(err?.response?.data?.message || 'Nie udało się pobrać listy modeli od dostawcy.');
    } finally {
      setFetchingModels(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        provider: form.provider,
        baseUrl: form.baseUrl.trim() || null,
        apiKey: form.apiKey.trim() || null,
        defaultModel: form.defaultModel.trim() || null,
        active: form.active,
        isDefault: form.isDefault,
      };
      if (editingId) {
        await updateAiConfig(editingId, payload);
        setSuccess(`Zaktualizowano konfigurację AI "${payload.name}".`);
      } else {
        await createAiConfig(payload);
        setSuccess(`Dodano nową konfigurację AI "${payload.name}".`);
      }
      resetForm();
      await loadConfigs();
    } catch (err) {
      setError(err?.response?.data?.message || 'Nie udało się zapisać konfiguracji AI.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSavedConfig = async (cfg) => {
    setError('');
    setSuccess('');
    setTestingId(cfg.id);
    try {
      const list = await fetchAiModels({ configId: cfg.id });
      const safeList = Array.isArray(list) ? list : [];
      setModelSearch('');
      setInspectedModelsModal({
        config: cfg,
        models: safeList,
      });
      setSuccess(
        `Połączenie z "${cfg.name}" działa poprawnie — dostępnych modeli: ${safeList.length}.`
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          `Błąd testu połączenia dla konfiguracji "${cfg.name}".`
      );
    } finally {
      setTestingId(null);
    }
  };

  const handleConfirmDelete = (cfg) => {
    openConfirm({
      title: 'Usuń konfigurację AI',
      message: `Czy na pewno chcesz usunąć konfigurację AI "${cfg.name}"? Operacji nie można cofnąć.`,
      onConfirm: async () => {
        setError('');
        setSuccess('');
        try {
          await deleteAiConfig(cfg.id);
          removeResourceAccess(RESOURCE_TYPES.AI, cfg.id);
          if (editingId === cfg.id) {
            resetForm();
          }
          setSuccess(`Usunięto konfigurację AI "${cfg.name}".`);
          await loadConfigs();
        } catch (err) {
          setError(err?.response?.data?.message || 'Nie udało się usunąć konfiguracji AI.');
        }
      },
    });
  };

  const filteredModalModels = inspectedModelsModal
    ? inspectedModelsModal.models.filter((m) => {
        if (!modelSearch.trim()) return true;
        const q = modelSearch.trim().toLowerCase();
        return (
          (m.id || '').toLowerCase().includes(q) ||
          (m.displayName || '').toLowerCase().includes(q)
        );
      })
    : [];

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
          onCancel={closeConfirm}
          onClose={closeConfirm}
        />
      )}

      <ResourceAccessModal
        isOpen={Boolean(accessModalConfig)}
        resourceType={RESOURCE_TYPES.AI}
        resourceTypeLabel="Konfiguracja AI"
        resourceId={accessModalConfig?.id}
        resourceName={accessModalConfig?.name}
        usageHint="Wybierz, które role mogą korzystać z tej konfiguracji i klucza API w modułach AI aplikacji."
        onClose={() => setAccessModalConfig(null)}
        onSaved={() => setAccessTick((t) => t + 1)}
      />

      {inspectedModelsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border-2 border-blue-600 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-extrabold truncate">
                  Dostępne modele: {inspectedModelsModal.config.name}
                </h3>
                <p className="text-xs opacity-90">
                  {PROVIDER_LABELS[inspectedModelsModal.config.provider] ||
                    inspectedModelsModal.config.provider}{' '}
                  • Znaleziono: {inspectedModelsModal.models.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedModelsModal(null)}
                className="p-1.5 rounded-lg hover:bg-blue-700 cursor-pointer"
                aria-label="Zamknij"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 border-b border-blue-100">
              <input
                type="text"
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder="Filtruj modele po nazwie lub ID..."
                className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black"
              />
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-1.5">
              {filteredModalModels.length === 0 ? (
                <p className="text-sm text-center py-6 font-medium text-black">
                  Brak modeli pasujących do filtra.
                </p>
              ) : (
                filteredModalModels.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-blue-100 bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold text-black truncate">
                        {m.id}
                      </div>
                      {m.displayName && m.displayName !== m.id && (
                        <div className="text-xs text-black opacity-80 truncate">
                          {m.displayName}
                        </div>
                      )}
                    </div>
                    {inspectedModelsModal.config.defaultModel === m.id && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 shrink-0">
                        Domyślny
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t border-blue-100 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedModelsModal(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <Bot size={24} className="text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-black">Integracje AI</h2>
          <p className="text-xs font-semibold text-black">
            Zarządzaj kluczami API dostawców modeli AI, testuj połączenia i pobieraj aktualne listy dostępnych modeli bezpośrednio z API dostawcy.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-500 rounded-xl text-xs font-bold text-black flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="p-1 rounded hover:bg-red-100 cursor-pointer"
            aria-label="Zamknij komunikat"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-green-50 border border-green-700 rounded-xl text-xs font-bold text-black flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-700 shrink-0" />
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess('')}
            className="p-1 rounded hover:bg-green-100 cursor-pointer"
            aria-label="Zamknij komunikat"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white p-5 rounded-xl border border-blue-200 space-y-4 shadow-xs"
      >
        <div className="flex items-center justify-between gap-2 border-b border-blue-100 pb-2.5">
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-black">
            {editingId ? `Edycja konfiguracji AI #${editingId}` : 'Nowa konfiguracja AI'}
          </h3>
          {editingId && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800">
              Tryb edycji
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Nazwa własna *</label>
            <input
              type="text"
              required
              maxLength={120}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="np. Gemini Produkcja"
              className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase mb-1">Dostawca AI *</label>
            <select
              value={form.provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black font-semibold"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase mb-1">
              Base URL {form.provider === 'OPENAI_COMPATIBLE' ? '*' : '(opcjonalny)'}
            </label>
            <input
              type="url"
              required={form.provider === 'OPENAI_COMPATIBLE'}
              maxLength={500}
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder={
                form.provider === 'OPENAI_COMPATIBLE'
                  ? 'np. https://api.deepseek.com/v1 lub http://localhost:11434/v1'
                  : `Domyślnie: ${currentProviderMeta.defaultBaseUrl}`
              }
              className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase mb-1">
              Klucz API{' '}
              {!editingId && form.provider !== 'OPENAI_COMPATIBLE'
                ? '*'
                : '(opcjonalny)'}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required={!editingId && form.provider !== 'OPENAI_COMPATIBLE'}
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder={
                editingId
                  ? 'Pozostaw puste, aby zachować obecny klucz'
                  : form.provider === 'OPENAI_COMPATIBLE'
                  ? 'Opcjonalny (np. dla lokalnej Ollamy)'
                  : 'Wklej klucz API dostawcy'
              }
              className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6">
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-xs font-bold uppercase">
                Domyślny model {models.length > 0 ? `(pobrano: ${models.length})` : ''}
              </label>
              {models.length > 0 && (
                <button
                  type="button"
                  onClick={() => setManualModelMode((v) => !v)}
                  className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  {manualModelMode ? 'Wybierz z pobranej listy' : 'Wpisz model ręcznie'}
                </button>
              )}
            </div>

            {models.length > 0 && !manualModelMode ? (
              <select
                value={form.defaultModel}
                onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black font-mono"
              >
                <option value="">-- Wybierz domyślny model --</option>
                {form.defaultModel &&
                  !models.some((m) => m.id === form.defaultModel) && (
                    <option value={form.defaultModel}>{form.defaultModel}</option>
                  )}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName && m.displayName !== m.id
                      ? `${m.displayName} (${m.id})`
                      : m.id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                maxLength={200}
                value={form.defaultModel}
                onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
                placeholder="np. gemini-2.5-flash, gpt-4o, claude-sonnet-4-5"
                className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black font-mono"
              />
            )}
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              disabled={fetchingModels}
              onClick={handleFetchModelsFromForm}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-400 text-black font-extrabold rounded-lg text-xs cursor-pointer disabled:opacity-60"
            >
              <RefreshCw size={15} className={fetchingModels ? 'animate-spin' : ''} />
              {fetchingModels ? 'Pobieranie...' : 'Pobierz dostępne modele'}
            </button>
          </div>

          <div className="md:col-span-3 flex flex-wrap items-center gap-4 py-2">
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="accent-blue-600 w-4 h-4"
              />
              Aktywna
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="accent-blue-600 w-4 h-4"
              />
              Domyślna w systemie
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-1.5 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-xs cursor-pointer disabled:opacity-60"
          >
            {editingId ? <Save size={15} /> : <Plus size={15} />}
            {saving
              ? 'Zapisywanie...'
              : editingId
              ? 'Zapisz zmiany'
              : 'Dodaj konfigurację'}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-white border border-blue-300 hover:bg-blue-50 rounded-lg text-xs font-bold text-black cursor-pointer"
            >
              Anuluj edycję
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-blue-600 text-white select-none">
                <th
                  onClick={() => toggleSort('name')}
                  className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Nazwa <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('provider')}
                  className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Dostawca <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('defaultModel')}
                  className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Domyślny model <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="p-3.5 font-bold">Zamaskowany klucz</th>
                <th
                  onClick={() => toggleSort('active')}
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
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center font-medium text-black">
                    Ładowanie konfiguracji AI...
                  </td>
                </tr>
              ) : sortedConfigs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center font-medium text-black">
                    Brak zapisanych konfiguracji AI. Dodaj pierwszą konfigurację w formularzu powyżej.
                  </td>
                </tr>
              ) : (
                sortedConfigs.map((cfg) => {
                  const accessSummary = getResourceAccessSummary(RESOURCE_TYPES.AI, cfg.id);
                  return (
                  <tr key={cfg.id} className="hover:bg-blue-50/40">
                    <td className="p-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-black">{cfg.name}</span>
                        {cfg.isDefault && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
                            <Star size={11} /> Domyślna
                          </span>
                        )}
                      </div>
                      {cfg.baseUrl && (
                        <div className="font-mono text-[11px] text-black opacity-75 mt-0.5 break-all">
                          {cfg.baseUrl}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 font-semibold text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-blue-200 font-mono font-bold text-black">
                        {cfg.provider}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-xs text-black">
                      {cfg.defaultModel || '—'}
                    </td>
                    <td className="p-3.5 font-mono text-xs text-black">
                      {cfg.hasApiKey ? cfg.apiKeyMasked : 'Brak klucza'}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${
                          cfg.active
                            ? 'bg-green-100 border-green-700 text-black'
                            : 'bg-red-100 border-red-600 text-black'
                        }`}
                      >
                        {cfg.active ? 'AKTYWNA' : 'WYŁĄCZONA'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setAccessModalConfig(cfg)}
                          title="Ustaw, które role mają dostęp do tej konfiguracji AI"
                          className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg font-bold text-xs cursor-pointer transition ${
                            accessSummary.isRestricted
                              ? 'bg-amber-100 hover:bg-amber-200 border-amber-600 text-black'
                              : 'bg-white border-blue-400 hover:bg-blue-50 text-black'
                          }`}
                        >
                          <Shield size={14} />
                          {accessSummary.isRestricted
                            ? `Dostęp (${accessSummary.allowedCount}/${accessSummary.totalRoles})`
                            : 'Dostęp'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(cfg)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                        >
                          <Pencil size={14} /> Edytuj
                        </button>
                        <button
                          type="button"
                          disabled={testingId === cfg.id}
                          onClick={() => handleTestSavedConfig(cfg)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-400 hover:bg-blue-100 text-black rounded-lg font-bold text-xs cursor-pointer disabled:opacity-60"
                        >
                          {testingId === cfg.id ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <Plug size={14} />
                          )}
                          {testingId === cfg.id ? 'Pobieranie...' : 'Testuj / Modele'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmDelete(cfg)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-400 hover:bg-red-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                        >
                          <Trash2 size={14} /> Usuń
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
