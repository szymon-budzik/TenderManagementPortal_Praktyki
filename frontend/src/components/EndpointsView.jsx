import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import {
  Trash2,
  Plus,
  Pencil,
  Check,
  X,
  Lightbulb,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  RefreshCw,
  HelpCircle,
  Code2,
  Table2,
  Sparkles,
  Copy,
  StickyNote,
  Save,
  Link2,
} from 'lucide-react';

const PAGE_SIZE = 10;

const SCRAPER_PRESETS = ['table tr', 'table td', 'table, td', 'article', '.tender, .notice'];

const DATE_TOKENS = [
  '{TODAY}',
  '{YESTERDAY}',
  '{TODAY-1D_START}',
  '{TODAY_END}',
  '{TODAY-7D}',
  '{TODAY-7D_COMPACT}',
  '{TODAY_COMPACT}',
];

function validateJsonString(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { valid: true, empty: true, error: null };
  try {
    JSON.parse(trimmed);
    return { valid: true, empty: false, error: null };
  } catch (e) {
    return { valid: false, empty: false, error: e.message };
  }
}

function parseValueForJson(rawVal) {
  const t = rawVal.trim();
  if (t === '') return '';
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (!Number.isNaN(Number(t)) && t !== '') return Number(t);
  if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'))) {
    try {
      return JSON.parse(t);
    } catch {
      return rawVal;
    }
  }
  return rawVal;
}

function rowsToJsonString(rows) {
  const obj = {};
  rows.forEach((r) => {
    const k = r.key.trim();
    if (!k) return;
    obj[k] = parseValueForJson(r.value);
  });
  if (Object.keys(obj).length === 0) return '';
  return JSON.stringify(obj, null, 2);
}

function jsonStringToRows(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return [{ key: '', value: '' }];
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed).map(([k, v]) => ({
        key: k,
        value: typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? ''),
      }));
      return entries.length > 0 ? entries : [{ key: '', value: '' }];
    }
  } catch {
    // niepoprawny lub nie-obiektowy JSON
  }
  return [{ key: '', value: '' }];
}

function parseSelectorTags(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function describeCssSelector(sel) {
  if (sel.includes(' ')) {
    const parts = sel.split(/\s+/).filter(Boolean);
    return `potomek: ${parts.join(' → ')}`;
  }
  return 'element';
}

function buildTestDiagnosticsMarkdown(modal) {
  if (!modal) return '';
  const ep = modal.endpoint;
  const lines = [
    `### Diagnostyka endpointu: ${ep.name}`,
    '',
    `- **Wynik:** ${modal.success ? 'POŁĄCZONO (OK)' : 'BŁĄD'}`,
    `- **Tryb / Metoda:** \`${ep.httpMethod}\``,
    `- **Kod HTTP:** \`${modal.statusCode > 0 ? modal.statusCode : 'Brak / Błąd sieci'}\``,
    `- **Czas odpowiedzi:** ${modal.responseTimeMs} ms`,
    `- **URL (szablon):** \`${ep.url}\``,
  ];

  if (modal.resolvedUrl && modal.resolvedUrl !== ep.url) {
    lines.push(`- **URL (wywołany):** \`${modal.resolvedUrl}\``);
  }

  if (ep.linkTemplate) {
    lines.push(`- **Szablon linku:** \`${ep.linkTemplate}\``);
  }

  if (ep.payload && ep.httpMethod !== 'GET') {
    const label = ep.httpMethod === 'SCRAPER' ? 'Selektor CSS' : 'Payload JSON';
    const lang = ep.httpMethod === 'POST' ? 'json' : 'text';
    lines.push('', `**${label}:**`, '```' + lang, ep.payload, '```');
  }

  lines.push('', '**Komunikat:**', `> ${modal.message}`);

  if (modal.details) {
    lines.push(
      '',
      '**Szczegóły techniczne / Treść odpowiedzi serwera:**',
      '```text',
      modal.details,
      '```'
    );
  }

  return lines.join('\n');
}

export default function EndpointsView() {
  const [endpoints, setEndpoints] = useState([]);
  const [page, setPage] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: 'id', dir: 'asc' });
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [newEndpoint, setNewEndpoint] = useState({
    name: '',
    url: '',
    httpMethod: 'GET',
    payload: '',
    linkTemplate: '',
    isActive: true,
  });

  const [postEditorMode, setPostEditorMode] = useState('JSON');
  const [postTableRows, setPostTableRows] = useState([{ key: '', value: '' }]);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [testingId, setTestingId] = useState(null);
  const [testStatuses, setTestStatuses] = useState({});
  const [testModal, setTestModal] = useState(null);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  // Modal notatki do endpointu
  const [noteModal, setNoteModal] = useState(null);
  const [savingNote, setSavingNote] = useState(false);

  const fetchEndpoints = async () => {
    try {
      const res = await api.get('/admin/endpoints');
      setEndpoints(res.data || []);
    } catch (err) {
      console.error('Błąd pobierania endpointów:', err);
    }
  };

  useEffect(() => {
    fetchEndpoints();
  }, []);

  const toggleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedEndpoints = useMemo(() => {
    const copy = [...endpoints];
    copy.sort((a, b) => {
      const { key, dir } = sortConfig;
      const mult = dir === 'asc' ? 1 : -1;
      const valA = a[key] ?? '';
      const valB = b[key] ?? '';
      if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        return (valA === valB ? 0 : valA ? -1 : 1) * mult;
      }
      return String(valA).localeCompare(String(valB), 'pl') * mult;
    });
    return copy;
  }, [endpoints, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedEndpoints.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedEndpoints = sortedEndpoints.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE
  );

  const handleNewMethodChange = (nextMethod) => {
    setNewEndpoint((prev) => ({
      ...prev,
      httpMethod: nextMethod,
      payload: nextMethod === 'GET' ? '' : prev.payload,
    }));
    if (nextMethod === 'GET') {
      setPostTableRows([{ key: '', value: '' }]);
    }
  };

  const handleSwitchPostMode = (mode) => {
    if (mode === 'TABLE') {
      setPostTableRows(jsonStringToRows(newEndpoint.payload));
    } else {
      const built = rowsToJsonString(postTableRows);
      if (built) {
        setNewEndpoint((prev) => ({ ...prev, payload: built }));
      }
    }
    setPostEditorMode(mode);
  };

  const updateTableRow = (index, field, val) => {
    const nextRows = postTableRows.map((row, i) =>
      i === index ? { ...row, [field]: val } : row
    );
    setPostTableRows(nextRows);
    setNewEndpoint((prev) => ({ ...prev, payload: rowsToJsonString(nextRows) }));
  };

  const addTableRow = () => {
    setPostTableRows((prev) => [...prev, { key: '', value: '' }]);
  };

  const removeTableRow = (index) => {
    const nextRows = postTableRows.filter((_, i) => i !== index);
    const safeRows = nextRows.length > 0 ? nextRows : [{ key: '', value: '' }];
    setPostTableRows(safeRows);
    setNewEndpoint((prev) => ({ ...prev, payload: rowsToJsonString(safeRows) }));
  };

  const formatJsonField = (raw, onUpdate) => {
    const trimmed = (raw || '').trim();
    if (!trimmed) return;
    try {
      const pretty = JSON.stringify(JSON.parse(trimmed), null, 2);
      onUpdate(pretty);
    } catch {
      // Niepoprawny JSON
    }
  };

  const removeNewSelectorTag = (idxToRemove) => {
    const tags = parseSelectorTags(newEndpoint.payload);
    const next = tags.filter((_, i) => i !== idxToRemove).join(', ');
    setNewEndpoint((prev) => ({ ...prev, payload: next }));
  };

  const handleInsertDateToken = (token) => {
    setNewEndpoint((prev) =>
      prev.httpMethod === 'POST'
        ? { ...prev, payload: (prev.payload || '') + token }
        : { ...prev, url: (prev.url || '') + token }
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (newEndpoint.httpMethod === 'POST') {
      const check = validateJsonString(newEndpoint.payload);
      if (!check.valid) return;
    }

    const finalPayload =
      newEndpoint.httpMethod === 'GET' ? null : newEndpoint.payload.trim() || null;

    try {
      await api.post('/admin/endpoints', {
        ...newEndpoint,
        name: newEndpoint.name.trim(),
        url: newEndpoint.url.trim(),
        payload: finalPayload,
        linkTemplate: newEndpoint.linkTemplate.trim() || null,
      });
      setNewEndpoint({
        name: '',
        url: '',
        httpMethod: 'GET',
        payload: '',
        linkTemplate: '',
        isActive: true,
      });
      setPostTableRows([{ key: '', value: '' }]);
      setPostEditorMode('JSON');
      fetchEndpoints();
    } catch (err) {
      console.error('Błąd dodawania źródła:', err);
    }
  };

  const handleToggleActive = async (ep) => {
    try {
      await api.put(`/admin/endpoints/${ep.id}`, {
        ...ep,
        isActive: !ep.isActive,
      });
      fetchEndpoints();
    } catch (err) {
      console.error('Błąd zmiany statusu:', err);
    }
  };

  const startEdit = (ep) => {
    setEditingId(ep.id);
    setEditForm({
      name: ep.name,
      url: ep.url,
      httpMethod: ep.httpMethod,
      payload: ep.httpMethod === 'GET' ? '' : ep.payload || '',
      linkTemplate: ep.linkTemplate || '',
      isActive: ep.isActive,
    });
  };

  const saveEdit = async (id) => {
    if (editForm.httpMethod === 'POST') {
      const check = validateJsonString(editForm.payload);
      if (!check.valid) return;
    }

    try {
      await api.put(`/admin/endpoints/${id}`, {
        ...editForm,
        payload: editForm.httpMethod === 'GET' ? '' : (editForm.payload || '').trim(),
        linkTemplate: (editForm.linkTemplate || '').trim(),
      });
      setEditingId(null);
      fetchEndpoints();
    } catch (err) {
      console.error('Błąd zapisu endpointu:', err);
    }
  };

  const confirmDelete = (ep) => {
    setConfirmDialog({
      title: 'Usuń źródło danych',
      message: `Czy na pewno chcesz usunąć endpoint "${ep.name}"?`,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/endpoints/${ep.id}`);
          fetchEndpoints();
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleTestConnection = async (ep) => {
    setTestingId(ep.id);
    setCopiedMarkdown(false);
    const startTs = Date.now();
    try {
      const res = await api.post(`/admin/endpoints/${ep.id}/test`);
      const data = res.data || {};
      const ok = Boolean(data.success);

      setTestStatuses((prev) => ({
        ...prev,
        [ep.id]: ok ? 'OK' : 'ERR',
      }));

      setTestModal({
        endpoint: ep,
        success: ok,
        statusCode: data.statusCode ?? 0,
        resolvedUrl: data.resolvedUrl || ep.url,
        responseTimeMs: data.responseTimeMs ?? Date.now() - startTs,
        message: data.message || (ok ? 'Połączenie udane.' : 'Wystąpił błąd podczas testu.'),
        details: data.details || '',
        testedAt: new Date().toLocaleTimeString('pl-PL'),
      });
    } catch (err) {
      const elapsed = Date.now() - startTs;
      const httpStatus = err.response?.data?.statusCode ?? err.response?.status ?? 0;
      const backendMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Brak odpowiedzi z serwera backendu.';

      setTestStatuses((prev) => ({ ...prev, [ep.id]: 'ERR' }));
      setTestModal({
        endpoint: ep,
        success: false,
        statusCode: httpStatus,
        resolvedUrl: err.response?.data?.resolvedUrl || ep.url,
        responseTimeMs: elapsed,
        message: `Błąd wywołania testu: ${backendMsg}`,
        details: err.response?.data
          ? JSON.stringify(err.response.data, null, 2)
          : `Szczegóły błędu sieciowego: ${err.message}`,
        testedAt: new Date().toLocaleTimeString('pl-PL'),
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleCopyDiagnosticsMarkdown = async () => {
    const markdown = buildTestDiagnosticsMarkdown(testModal);
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = markdown;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2500);
  };

  const handleOpenNoteModal = (ep) => {
    setNoteModal({
      endpoint: ep,
      text: ep.notes || '',
    });
  };

  const handleSaveNote = async () => {
    if (!noteModal) return;
    setSavingNote(true);
    try {
      await api.patch(`/admin/endpoints/${noteModal.endpoint.id}/notes`, {
        notes: noteModal.text,
      });
      setNoteModal(null);
      fetchEndpoints();
    } catch (err) {
      console.error('Błąd zapisu notatki endpointu:', err);
    } finally {
      setSavingNote(false);
    }
  };

  const newPostJsonStatus =
    newEndpoint.httpMethod === 'POST' ? validateJsonString(newEndpoint.payload) : { valid: true };
  const newSelectorTags =
    newEndpoint.httpMethod === 'SCRAPER' ? parseSelectorTags(newEndpoint.payload) : [];
  const editPostJsonStatus =
    editForm.httpMethod === 'POST' ? validateJsonString(editForm.payload) : { valid: true };

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

      {/* Modal notatki obsługi endpointu */}
      {noteModal && (
        <div
          onClick={() => setNoteModal(null)}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border-2 border-blue-600 max-w-2xl w-full p-6 shadow-xl space-y-4 text-black"
          >
            <div className="flex items-start justify-between gap-4 border-b border-blue-100 pb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StickyNote size={18} className="text-blue-600 shrink-0" />
                  <span className="text-xs font-extrabold uppercase tracking-wide text-blue-700">
                    Notatka obsługi źródła
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold bg-blue-100 border border-blue-400">
                    {noteModal.endpoint.httpMethod}
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-black truncate mt-1">
                  {noteModal.endpoint.name}
                </h3>
                <div className="text-xs font-mono text-slate-600 truncate">
                  {noteModal.endpoint.url}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNoteModal(null)}
                className="p-1.5 rounded-lg border border-blue-300 hover:bg-blue-50 cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase text-black">
                Instrukcja / uwagi dotyczące konfiguracji tego endpointu
              </label>
              <textarea
                rows={8}
                autoFocus
                value={noteModal.text}
                onChange={(e) => setNoteModal({ ...noteModal, text: e.target.value })}
                placeholder="Zapisz np. wymagane parametry w URL, format dat, strukturę JSON dla POST, działające selektory CSS, limity zapytań..."
                className="w-full p-3.5 border-2 border-blue-300 focus:border-blue-600 focus:outline-none rounded-xl bg-slate-50 text-black text-sm leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-blue-100">
              <button
                type="button"
                onClick={() => setNoteModal({ ...noteModal, text: '' })}
                disabled={!noteModal.text}
                className="px-3.5 py-2 bg-white border border-red-300 hover:bg-red-50 disabled:opacity-40 text-black font-bold rounded-xl text-xs cursor-pointer"
              >
                Wyczyść notatkę
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNoteModal(null)}
                  className="px-4 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-black font-bold rounded-xl text-xs cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  disabled={savingNote}
                  onClick={handleSaveNote}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs cursor-pointer"
                >
                  <Save size={14} />
                  {savingNote ? 'Zapisywanie...' : 'Zapisz notatkę'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Okienko ze szczegółowym wynikiem testu połączenia */}
      {testModal && (
        <div
          onClick={() => setTestModal(null)}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`bg-white rounded-2xl border-2 max-w-2xl w-full p-6 shadow-xl space-y-5 text-black max-h-[85vh] overflow-y-auto ${
              testModal.success ? 'border-green-700' : 'border-red-700'
            }`}
          >
            <div className="flex items-start justify-between gap-4 border-b border-blue-100 pb-4">
              <div className="flex items-start gap-3 min-w-0">
                {testModal.success ? (
                  <CheckCircle2 size={26} className="text-green-700 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={26} className="text-red-700 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
                    Diagnostyka źródła danych (bez zapisu do bazy)
                  </div>
                  <h3 className="text-lg font-extrabold text-black truncate mt-0.5">
                    {testModal.endpoint.name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestModal(null)}
                className="p-1.5 rounded-lg border border-blue-300 hover:bg-blue-50 cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div
                className={`p-3 rounded-xl border-2 ${
                  testModal.success
                    ? 'bg-green-100 border-green-700'
                    : 'bg-red-100 border-red-700'
                }`}
              >
                <div className="text-[11px] font-bold uppercase">Wynik</div>
                <div className="text-sm font-extrabold mt-0.5">
                  {testModal.success ? 'POŁĄCZONO' : 'BŁĄD'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-[11px] font-bold uppercase">Kod HTTP</div>
                <div className="text-sm font-mono font-extrabold mt-0.5">
                  {testModal.statusCode > 0 ? testModal.statusCode : 'Brak / Sieć'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-[11px] font-bold uppercase">Czas odpowiedzi</div>
                <div className="text-sm font-mono font-extrabold mt-0.5">
                  {testModal.responseTimeMs} ms
                </div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-[11px] font-bold uppercase">Tryb / Godzina</div>
                <div className="text-xs font-mono font-extrabold mt-1">
                  {testModal.endpoint.httpMethod} • {testModal.testedAt}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-blue-200 rounded-xl space-y-1">
              <div className="text-[11px] font-extrabold uppercase text-blue-800">
                Testowany adres URL
              </div>
              <div className="text-xs font-mono break-all text-black">
                {testModal.resolvedUrl || testModal.endpoint.url}
              </div>
              {testModal.resolvedUrl && testModal.resolvedUrl !== testModal.endpoint.url && (
                <div className="text-[11px] font-mono break-all text-slate-500">
                  Szablon: {testModal.endpoint.url}
                </div>
              )}
              {testModal.endpoint.payload && testModal.endpoint.httpMethod !== 'GET' && (
                <div className="text-xs font-mono whitespace-pre-wrap break-all text-slate-700 pt-1.5 mt-1 border-t border-slate-200">
                  <span className="font-bold">
                    {testModal.endpoint.httpMethod === 'SCRAPER'
                      ? 'Selektor CSS: '
                      : 'Payload JSON:\n'}
                  </span>
                  {testModal.endpoint.payload}
                </div>
              )}
            </div>

            <div
              className={`p-3.5 rounded-xl border-2 text-sm font-bold whitespace-pre-line ${
                testModal.success
                  ? 'bg-green-50 border-green-600 text-black'
                  : 'bg-red-50 border-red-600 text-black'
              }`}
            >
              {testModal.message}
            </div>

            {testModal.details && (
              <div className="space-y-1.5">
                <div className="text-xs font-extrabold uppercase text-black">
                  Szczegóły techniczne / Treść odpowiedzi serwera
                </div>
                <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono whitespace-pre-wrap break-all max-h-60 overflow-y-auto border border-slate-700">
                  {testModal.details}
                </pre>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-blue-100">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={testingId === testModal.endpoint.id}
                  onClick={() => handleTestConnection(testModal.endpoint)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-100 hover:bg-amber-200 border-2 border-amber-500 text-black font-extrabold rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    size={14}
                    className={testingId === testModal.endpoint.id ? 'animate-spin' : ''}
                  />
                  {testingId === testModal.endpoint.id ? 'Testowanie...' : 'Ponów test'}
                </button>

                <button
                  type="button"
                  onClick={handleCopyDiagnosticsMarkdown}
                  title="Kopiuje kod błędu, konfigurację i szczegóły techniczne jako gotowy Markdown do wklejenia na czat"
                  className={`inline-flex items-center gap-1.5 px-4 py-2 border-2 font-extrabold rounded-xl text-xs cursor-pointer transition ${
                    copiedMarkdown
                      ? 'bg-green-300 border-green-700 text-black'
                      : 'bg-white hover:bg-blue-50 border-blue-600 text-black'
                  }`}
                >
                  {copiedMarkdown ? <Check size={14} /> : <Copy size={14} />}
                  {copiedMarkdown ? 'Skopiowano (Markdown)!' : 'Kopiuj jako Markdown'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setTestModal(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold text-black">
          Zarządzanie Źródłami Danych (API i Web Scraper)
        </h2>
        <p className="text-xs font-semibold text-black mt-0.5">
          URL i Payload obsługują dynamiczne zmienne daty ({'{TODAY}'}, {'{TODAY-1D_START}'}), a opcjonalny Szablon linku ({'{objectId}'}, {'{id}'}) buduje klikalne adresy bez hardkodowania portali.
        </p>
      </div>

      {/* FORMULARZ DODAWANIA NOWEGO ŹRÓDŁA */}
      <form
        onSubmit={handleCreate}
        className="bg-white p-5 rounded-xl border-2 border-blue-600 space-y-4 shadow-xs"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-3">
            <label className="block text-xs font-bold uppercase mb-1">Nazwa źródła</label>
            <input
              type="text"
              required
              value={newEndpoint.name}
              onChange={(e) => setNewEndpoint({ ...newEndpoint, name: e.target.value })}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black font-semibold"
              placeholder="np. Portal BIP / BZP / TED"
            />
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-bold uppercase mb-1">
              URL Endpointu / Strony WWW
            </label>
            <input
              type="text"
              required
              value={newEndpoint.url}
              onChange={(e) => setNewEndpoint({ ...newEndpoint, url: e.target.value })}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black font-mono text-xs"
              placeholder="https://... (możesz użyć np. {TODAY-1D_START})"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase mb-1">Tryb / Metoda</label>
            <select
              value={newEndpoint.httpMethod}
              onChange={(e) => handleNewMethodChange(e.target.value)}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-black font-extrabold text-xs"
            >
              <option value="GET">API GET</option>
              <option value="POST">API POST</option>
              <option value="SCRAPER">SCRAPER (BS4)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={newEndpoint.httpMethod === 'POST' && !newPostJsonStatus.valid}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-extrabold rounded-lg text-xs cursor-pointer"
            >
              <Plus size={16} /> Dodaj Źródło
            </button>
          </div>
        </div>

        {/* Ściągawka dynamicznych zmiennych daty + Szablon linku */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-6 p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
            <div className="text-[11px] font-extrabold uppercase text-blue-900">
              Zmienne daty (kliknij, aby wstawić do {newEndpoint.httpMethod === 'POST' ? 'Payloadu' : 'URL'})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DATE_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => handleInsertDateToken(token)}
                  title="Kliknij, aby dopisać zmienną"
                  className="px-2 py-0.5 bg-white hover:bg-blue-100 border border-blue-400 rounded text-[11px] font-mono font-bold text-black cursor-pointer"
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 p-3 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-1">
            <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-emerald-950">
              <Link2 size={13} />
              Szablon linku do przetargu (opcjonalny — np. {'{objectId}'}, {'{tenderId}'}, {'{id}'})
            </label>
            <input
              type="text"
              value={newEndpoint.linkTemplate}
              onChange={(e) => setNewEndpoint({ ...newEndpoint, linkTemplate: e.target.value })}
              placeholder="np. https://ezamowienia.gov.pl/mo-client-board/bzp/notice-details/id/{objectId}"
              className="w-full px-3 py-1.5 border border-emerald-400 rounded-lg bg-white text-black font-mono text-xs"
            />
          </div>
        </div>

        {/* SEKCJA PAYLOADU / SELEKTORA ZALEŻNA OD METODY */}
        {newEndpoint.httpMethod === 'GET' && (
          <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-300 space-y-1">
            <label className="block text-xs font-bold uppercase text-slate-400">
              Payload (zablokowany dla metody GET)
            </label>
            <input
              type="text"
              disabled
              value=""
              placeholder="Metoda GET nie używa payloadu — parametry zapytania wpisuj bezpośrednio w adresie URL (np. ?PageSize=25)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-200 text-slate-500 text-xs font-mono cursor-not-allowed"
            />
          </div>
        )}

        {newEndpoint.httpMethod === 'POST' && (
          <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase text-blue-800">
                  Payload JSON (ciało zapytania POST)
                </span>
                {!newPostJsonStatus.empty && (
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${
                      newPostJsonStatus.valid
                        ? 'bg-green-200 border-green-700 text-black'
                        : 'bg-red-200 border-red-700 text-red-950'
                    }`}
                  >
                    {newPostJsonStatus.valid ? 'Poprawny JSON' : 'Błąd składni JSON'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {postEditorMode === 'JSON' && newEndpoint.payload.trim() && (
                  <button
                    type="button"
                    onClick={() =>
                      formatJsonField(newEndpoint.payload, (pretty) =>
                        setNewEndpoint((prev) => ({ ...prev, payload: pretty }))
                      )
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-blue-400 hover:bg-blue-50 rounded-lg text-[11px] font-bold cursor-pointer"
                  >
                    <Sparkles size={12} /> Formatuj JSON
                  </button>
                )}

                <div className="inline-flex rounded-lg border border-blue-400 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => handleSwitchPostMode('JSON')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold cursor-pointer ${
                      postEditorMode === 'JSON'
                        ? 'bg-blue-600 text-white'
                        : 'text-black hover:bg-blue-50'
                    }`}
                  >
                    <Code2 size={13} /> JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchPostMode('TABLE')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold cursor-pointer ${
                      postEditorMode === 'TABLE'
                        ? 'bg-blue-600 text-white'
                        : 'text-black hover:bg-blue-50'
                    }`}
                  >
                    <Table2 size={13} /> Tabela pól
                  </button>
                </div>
              </div>
            </div>

            {postEditorMode === 'JSON' ? (
              <div className="space-y-1.5">
                <textarea
                  rows={4}
                  value={newEndpoint.payload}
                  onChange={(e) => setNewEndpoint({ ...newEndpoint, payload: e.target.value })}
                  placeholder={
                    '{\n  "query": "publication-date >= {TODAY-7D_COMPACT}",\n  "fields": ["publication-number", "BT-21-Procedure"],\n  "limit": 25\n}'
                  }
                  className={`w-full px-3.5 py-2.5 border rounded-lg bg-white text-black font-mono text-xs leading-relaxed ${
                    newPostJsonStatus.valid ? 'border-blue-300' : 'border-red-600 bg-red-50/40'
                  }`}
                />
                {!newPostJsonStatus.valid && (
                  <div className="text-[11px] font-bold text-red-700">
                    {newPostJsonStatus.error}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-lg border border-blue-200 overflow-hidden bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-blue-200">
                        <th className="p-2 font-extrabold w-1/3">Klucz (nazwa pola)</th>
                        <th className="p-2 font-extrabold">
                          Wartość (tekst, liczba, true/false lub tablica np. ["a","b"])
                        </th>
                        <th className="p-2 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100">
                      {postTableRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.key}
                              onChange={(e) => updateTableRow(idx, 'key', e.target.value)}
                              placeholder="np. limit"
                              className="w-full px-2.5 py-1.5 border border-blue-200 rounded font-mono text-xs"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.value}
                              onChange={(e) => updateTableRow(idx, 'value', e.target.value)}
                              placeholder='np. 25 albo ["BT-21-Procedure"]'
                              className="w-full px-2.5 py-1.5 border border-blue-200 rounded font-mono text-xs"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeTableRow(idx)}
                              className="p-1 rounded text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={addTableRow}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-blue-400 hover:bg-blue-50 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    <Plus size={13} /> Dodaj wiersz
                  </button>
                  <span className="text-[11px] font-semibold text-slate-600">
                    Tabela automatycznie generuje poprawny JSON do wysłania przez POST.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {newEndpoint.httpMethod === 'SCRAPER' && (
          <div className="bg-purple-50/70 p-4 rounded-xl border border-purple-300 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-extrabold uppercase text-purple-900">
                  Selektor CSS (opcjonalnie — puste = tryb automatyczny)
                </label>

                <div className="relative group inline-flex items-center">
                  <HelpCircle
                    size={16}
                    className="text-purple-700 hover:text-purple-900 cursor-help"
                  />
                  <div className="hidden group-hover:block absolute left-0 top-6 z-40 w-96 p-3.5 bg-slate-900 text-white text-xs rounded-xl shadow-xl border border-purple-400 space-y-1.5 leading-relaxed">
                    <div className="font-extrabold text-purple-300 uppercase text-[11px]">
                      Składnia selektorów CSS w Scraperze
                    </div>
                    <div>
                      <span className="font-mono font-bold text-amber-300">table tr</span> — wszystkie wiersze <code>&lt;tr&gt;</code> wewnątrz tabeli (zalecane dla tabel ogłoszeń)
                    </div>
                    <div>
                      <span className="font-mono font-bold text-amber-300">table td</span> — komórki <code>&lt;td&gt;</code> znajdujące się <b>wewnątrz</b> <code>&lt;table&gt;</code> (spacja = potomek)
                    </div>
                    <div>
                      <span className="font-mono font-bold text-amber-300">table, td</span> — wszystkie tabele <b>ORAZ</b> wszystkie komórki <code>&lt;td&gt;</code> (przecinek = LUB)
                    </div>
                    <div>
                      <span className="font-mono font-bold text-amber-300">.tender-row, article</span> — elementy o klasie <code>tender-row</code> lub znaczniki <code>&lt;article&gt;</code>
                    </div>
                    <div className="pt-1 border-t border-slate-700 text-[11px] text-slate-300">
                      Gdy podasz selektor, scraper pobiera <b>wyłącznie</b> elementy pasujące do niego (bez mieszania z trybem automatycznym).
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-600">Przykłady:</span>
                {SCRAPER_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNewEndpoint((prev) => ({ ...prev, payload: preset }))}
                    className="px-2 py-0.5 bg-white hover:bg-purple-100 border border-purple-400 rounded text-[11px] font-mono font-bold text-black cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              value={newEndpoint.payload}
              onChange={(e) => setNewEndpoint({ ...newEndpoint, payload: e.target.value })}
              placeholder="np. table tr  albo  table td  albo  table, td  albo  .offer-item, article"
              className="w-full px-3.5 py-2 border border-purple-400 rounded-lg bg-white text-black font-mono text-xs"
            />

            {newSelectorTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {newSelectorTags.map((sel, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-200 border border-slate-400 rounded-md text-xs font-mono font-bold text-black"
                  >
                    <span>{sel}</span>
                    <span className="text-[10px] font-sans font-semibold text-slate-600">
                      ({describeCssSelector(sel)})
                    </span>
                    <button
                      type="button"
                      onClick={() => removeNewSelectorTag(idx)}
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
      </form>

      {/* TABELA ŹRÓDEŁ DANYCH */}
      <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
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
                onClick={() => toggleSort('httpMethod')}
                className="p-3.5 font-bold w-28 cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  Tryb <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('url')}
                className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  URL, Szablon linku i Parametry <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('isActive')}
                className="p-3.5 font-bold w-36 cursor-pointer hover:bg-blue-700 whitespace-nowrap"
              >
                <div className="inline-flex items-center gap-1">
                  Status <ArrowUpDown size={14} />
                </div>
              </th>
              <th className="p-3.5 font-bold w-52 text-center whitespace-nowrap">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100">
            {paginatedEndpoints.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-6 text-center font-medium text-black">
                  Brak dodanych źródeł.
                </td>
              </tr>
            ) : (
              paginatedEndpoints.map((ep) => {
                const isEditing = editingId === ep.id;
                const testState = testStatuses[ep.id];
                const hasNote = Boolean(ep.notes && ep.notes.trim().length > 0);
                const epSelectorTags =
                  ep.httpMethod === 'SCRAPER' ? parseSelectorTags(ep.payload) : [];

                return (
                  <tr key={ep.id} className="hover:bg-blue-50/50">
                    <td className="p-3.5 font-bold align-top">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-blue-400 rounded bg-white text-black"
                        />
                      ) : (
                        ep.name
                      )}
                    </td>

                    <td className="p-3.5 font-mono font-bold align-top">
                      {isEditing ? (
                        <select
                          value={editForm.httpMethod}
                          onChange={(e) => {
                            const nextM = e.target.value;
                            setEditForm({
                              ...editForm,
                              httpMethod: nextM,
                              payload: nextM === 'GET' ? '' : editForm.payload,
                            });
                          }}
                          className="px-2.5 py-1.5 border border-blue-400 rounded bg-white text-black text-xs"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="SCRAPER">SCRAPER</option>
                        </select>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-extrabold border ${
                            ep.httpMethod === 'SCRAPER'
                              ? 'bg-purple-200 border-purple-700 text-black'
                              : ep.httpMethod === 'POST'
                              ? 'bg-amber-200 border-amber-700 text-black'
                              : 'bg-blue-100 border-blue-500 text-black'
                          }`}
                        >
                          {ep.httpMethod}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 font-mono text-xs break-all align-top">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editForm.url}
                            onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                            placeholder="URL (obsługuje zmienne daty, np. {TODAY-1D_START})"
                            className="w-full px-2.5 py-1.5 border border-blue-400 rounded bg-white text-black"
                          />

                          <input
                            type="text"
                            value={editForm.linkTemplate || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, linkTemplate: e.target.value })
                            }
                            placeholder="Szablon linku (opcjonalnie), np. https://.../id/{objectId}"
                            className="w-full px-2.5 py-1.5 border border-emerald-500 rounded bg-emerald-50/40 text-black"
                          />

                          {editForm.httpMethod === 'GET' ? (
                            <input
                              type="text"
                              disabled
                              value=""
                              placeholder="GET nie używa payloadu"
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-slate-200 text-slate-500 cursor-not-allowed"
                            />
                          ) : editForm.httpMethod === 'POST' ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-[10px] font-sans font-extrabold ${
                                    editPostJsonStatus.valid ? 'text-green-700' : 'text-red-700'
                                  }`}
                                >
                                  {editPostJsonStatus.empty
                                    ? 'Payload JSON (opcjonalnie)'
                                    : editPostJsonStatus.valid
                                    ? 'Poprawny JSON'
                                    : `Błąd JSON: ${editPostJsonStatus.error}`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    formatJsonField(editForm.payload, (pretty) =>
                                      setEditForm((prev) => ({ ...prev, payload: pretty }))
                                    )
                                  }
                                  className="text-[10px] font-sans font-bold text-blue-700 hover:underline cursor-pointer"
                                >
                                  Formatuj JSON
                                </button>
                              </div>
                              <textarea
                                rows={4}
                                value={editForm.payload}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, payload: e.target.value })
                                }
                                placeholder='{"limit": 25}'
                                className={`w-full px-2.5 py-1.5 border rounded bg-white text-black font-mono text-xs ${
                                  editPostJsonStatus.valid
                                    ? 'border-blue-300'
                                    : 'border-red-600 bg-red-50'
                                }`}
                              />
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={editForm.payload}
                              onChange={(e) =>
                                setEditForm({ ...editForm, payload: e.target.value })
                              }
                              placeholder="Selektor CSS, np. table tr lub table td lub table, td"
                              className="w-full px-2.5 py-1.5 border border-purple-400 rounded bg-white text-black"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div>{ep.url}</div>

                          {ep.linkTemplate && (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-400 rounded text-[11px] font-mono text-emerald-950 break-all">
                              <Link2 size={12} className="shrink-0 text-emerald-700" />
                              <span>
                                <b>Link:</b> {ep.linkTemplate}
                              </span>
                            </div>
                          )}

                          {ep.httpMethod === 'POST' && ep.payload && (
                            <pre className="text-[11px] text-black bg-blue-50/80 p-2 rounded border border-blue-200 whitespace-pre-wrap break-all max-h-28 overflow-y-auto">
                              {ep.payload}
                            </pre>
                          )}

                          {ep.httpMethod === 'SCRAPER' && epSelectorTags.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 pt-0.5">
                              <span className="text-[10px] font-sans font-extrabold uppercase text-purple-800">
                                Selektor CSS:
                              </span>
                              {epSelectorTags.map((sel, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-purple-100 border border-purple-400 rounded text-[11px] font-mono font-bold text-black"
                                >
                                  {sel}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="p-3.5 whitespace-nowrap align-top">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(ep)}
                        className={`w-28 py-1.5 text-center rounded-lg text-xs font-extrabold border-2 shadow-xs transition transform active:scale-95 cursor-pointer ${
                          ep.isActive
                            ? 'bg-green-400 hover:bg-green-500 border-green-800 text-black'
                            : 'bg-red-400 hover:bg-red-500 border-red-800 text-black'
                        }`}
                      >
                        {ep.isActive ? 'AKTYWNY' : 'WYŁĄCZONY'}
                      </button>
                    </td>

                    {/* Macierz 2x2 przycisków akcji */}
                    <td className="p-3.5 align-top whitespace-nowrap">
                      <div className="grid grid-cols-2 gap-1.5 w-44 mx-auto">
                        {/* Górny lewy: Testuj */}
                        <button
                          type="button"
                          onClick={() => handleTestConnection(ep)}
                          disabled={testingId === ep.id}
                          title="Przetestuj połączenie i zobacz szczegóły odpowiedzi"
                          className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 border-2 text-black rounded-lg font-bold text-xs cursor-pointer transition ${
                            testState === 'OK'
                              ? 'bg-green-300 border-green-700'
                              : testState === 'ERR'
                              ? 'bg-red-300 border-red-700'
                              : 'bg-amber-100 hover:bg-amber-200 border-amber-500'
                          }`}
                        >
                          <Lightbulb
                            size={13}
                            className={testingId === ep.id ? 'animate-pulse' : ''}
                          />
                          {testingId === ep.id
                            ? 'Test...'
                            : testState === 'OK'
                            ? 'OK'
                            : testState === 'ERR'
                            ? 'Błąd'
                            : 'Testuj'}
                        </button>

                        {/* Górny prawy: Notatka */}
                        <button
                          type="button"
                          onClick={() => handleOpenNoteModal(ep)}
                          title={
                            hasNote
                              ? 'Edytuj zapisaną notatkę obsługi endpointu'
                              : 'Dodaj notatkę jak obsługiwać ten endpoint'
                          }
                          className={`relative inline-flex items-center justify-center gap-1 px-2 py-1.5 border rounded-lg font-bold text-xs cursor-pointer transition ${
                            hasNote
                              ? 'bg-blue-100 hover:bg-blue-200 border-blue-600 text-black'
                              : 'bg-white hover:bg-blue-50 border-blue-300 text-black'
                          }`}
                        >
                          <StickyNote size={13} className={hasNote ? 'text-blue-700' : ''} />
                          Notatka
                          {hasNote && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                          )}
                        </button>

                        {/* Dolny wiersz: Zapisz / Anuluj (w edycji) lub Edytuj / Usuń */}
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={editForm.httpMethod === 'POST' && !editPostJsonStatus.valid}
                              onClick={() => saveEdit(ep.id)}
                              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <Check size={13} /> Zapisz
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-white border border-blue-300 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <X size={13} /> Anuluj
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(ep)}
                              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <Pencil size={13} /> Edytuj
                            </button>
                            <button
                              type="button"
                              onClick={() => confirmDelete(ep)}
                              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-white border border-red-400 hover:bg-red-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <Trash2 size={13} /> Usuń
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginacja (10 endpointów na stronę) */}
      <div className="flex items-center justify-between">
        <button
          disabled={currentPage === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="px-4 py-2 bg-white border border-blue-400 rounded-lg font-bold text-black disabled:opacity-40 hover:bg-blue-50 cursor-pointer"
        >
          Poprzednia
        </button>
        <span className="font-bold text-sm text-black">
          Strona {currentPage + 1} z {totalPages} (łącznie: {sortedEndpoints.length}, po {PAGE_SIZE} na stronę)
        </span>
        <button
          disabled={currentPage + 1 >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="px-4 py-2 bg-white border border-blue-400 rounded-lg font-bold text-black disabled:opacity-40 hover:bg-blue-50 cursor-pointer"
        >
          Następna
        </button>
      </div>
    </div>
  );
}