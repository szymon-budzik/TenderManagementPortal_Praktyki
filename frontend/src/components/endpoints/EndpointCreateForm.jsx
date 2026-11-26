import { useState } from 'react';
import { Plus, Link2, Sparkles, Code2, Table2, X, HelpCircle } from 'lucide-react';
import {
  EMPTY_ENDPOINT,
  SCRAPER_PRESETS,
  describeCssSelector,
  formatJsonField,
  jsonStringToRows,
  parseSelectorTags,
  rowsToJsonString,
  validateJsonString,
} from './endpointUtils';

export default function EndpointCreateForm({ onCreate }) {
  const [newEndpoint, setNewEndpoint] = useState(EMPTY_ENDPOINT);
  const [postEditorMode, setPostEditorMode] = useState('JSON');
  const [postTableRows, setPostTableRows] = useState([{ key: '', value: '' }]);

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

  const removeNewSelectorTag = (idxToRemove) => {
    const tags = parseSelectorTags(newEndpoint.payload);
    const next = tags.filter((_, i) => i !== idxToRemove).join(', ');
    setNewEndpoint((prev) => ({ ...prev, payload: next }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newEndpoint.httpMethod === 'POST') {
      const check = validateJsonString(newEndpoint.payload);
      if (!check.valid) return;
    }

    const finalPayload =
      newEndpoint.httpMethod === 'GET' ? null : newEndpoint.payload.trim() || null;

    const ok = await onCreate({
      ...newEndpoint,
      name: newEndpoint.name.trim(),
      url: newEndpoint.url.trim(),
      payload: finalPayload,
      linkTemplate: newEndpoint.linkTemplate.trim() || null,
    });

    if (ok) {
      setNewEndpoint(EMPTY_ENDPOINT);
      setPostTableRows([{ key: '', value: '' }]);
      setPostEditorMode('JSON');
    }
  };

  const newPostJsonStatus =
    newEndpoint.httpMethod === 'POST' ? validateJsonString(newEndpoint.payload) : { valid: true };
  const newSelectorTags =
    newEndpoint.httpMethod === 'SCRAPER' ? parseSelectorTags(newEndpoint.payload) : [];

  return (
    <form
      onSubmit={handleSubmit}
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
            placeholder="https://..."
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

      {/* Szablon linku */}
      <div className="p-3 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-1">
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
  );
}
