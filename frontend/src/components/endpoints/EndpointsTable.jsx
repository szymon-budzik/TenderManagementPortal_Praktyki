import {
  ArrowUpDown,
  Link2,
  Lightbulb,
  StickyNote,
  Shield,
  Check,
  X,
  Pencil,
  Trash2,
} from 'lucide-react';
import { RESOURCE_TYPES, getResourceAccessSummary } from '../../rolesStore';
import {
  PAGE_SIZE,
  formatJsonField,
  parseSelectorTags,
  validateJsonString,
} from './endpointUtils';

export default function EndpointsTable({
  endpoints,
  totalCount,
  currentPage,
  totalPages,
  onPageChange,
  onToggleSort,
  editingId,
  editForm,
  setEditForm,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleActive,
  onTestConnection,
  testingId,
  testStatuses,
  onOpenNote,
  onOpenAccess,
  onConfirmDelete,
}) {
  const editPostJsonStatus =
    editForm.httpMethod === 'POST' ? validateJsonString(editForm.payload) : { valid: true };

  return (
    <>
      <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-blue-600 text-white select-none">
              <th
                onClick={() => onToggleSort('name')}
                className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  Nazwa <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                onClick={() => onToggleSort('httpMethod')}
                className="p-3.5 font-bold w-28 cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  Tryb <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                onClick={() => onToggleSort('url')}
                className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  URL, Szablon linku i Parametry <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                onClick={() => onToggleSort('isActive')}
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
            {endpoints.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-6 text-center font-medium text-black">
                  Brak dodanych źródeł.
                </td>
              </tr>
            ) : (
              endpoints.map((ep) => {
                const isEditing = editingId === ep.id;
                const testState = testStatuses[ep.id];
                const hasNote = Boolean(ep.notes && ep.notes.trim().length > 0);
                const accessSummary = getResourceAccessSummary(RESOURCE_TYPES.ENDPOINT, ep.id);
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
                            placeholder="URL endpointu"
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
                        onClick={() => onToggleActive(ep)}
                        className={`w-28 py-1.5 text-center rounded-lg text-xs font-extrabold border-2 shadow-xs transition transform active:scale-95 cursor-pointer ${
                          ep.isActive
                            ? 'bg-green-400 hover:bg-green-500 border-green-800 text-black'
                            : 'bg-red-400 hover:bg-red-500 border-red-800 text-black'
                        }`}
                      >
                        {ep.isActive ? 'AKTYWNY' : 'WYŁĄCZONY'}
                      </button>
                    </td>

                    <td className="p-3.5 align-top whitespace-nowrap">
                      <div className="grid grid-cols-2 gap-1.5 w-44 mx-auto">
                        <button
                          type="button"
                          onClick={() => onTestConnection(ep)}
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

                        <button
                          type="button"
                          onClick={() => onOpenNote(ep)}
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

                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={editForm.httpMethod === 'POST' && !editPostJsonStatus.valid}
                              onClick={() => onSaveEdit(ep.id)}
                              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <Check size={13} /> Zapisz
                            </button>
                            <button
                              type="button"
                              onClick={onCancelEdit}
                              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-white border border-blue-300 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <X size={13} /> Anuluj
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onStartEdit(ep)}
                              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <Pencil size={13} /> Edytuj
                            </button>
                            <button
                              type="button"
                              onClick={() => onConfirmDelete(ep)}
                              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-white border border-red-400 hover:bg-red-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <Trash2 size={13} /> Usuń
                            </button>
                          </>
                        )}

                        {onOpenAccess && (
                          <button
                            type="button"
                            onClick={() => onOpenAccess(ep)}
                            title="Ustaw, które role mają dostęp do tego endpointu"
                            className={`col-span-2 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 border rounded-lg font-bold text-xs cursor-pointer transition ${
                              accessSummary.isRestricted
                                ? 'bg-amber-100 hover:bg-amber-200 border-amber-600 text-black'
                                : 'bg-white hover:bg-blue-50 border-blue-400 text-black'
                            }`}
                          >
                            <Shield size={13} />
                            {accessSummary.isRestricted
                              ? `Dostęp ról (${accessSummary.allowedCount}/${accessSummary.totalRoles})`
                              : 'Dostęp ról'}
                          </button>
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

      <div className="flex items-center justify-between">
        <button
          disabled={currentPage === 0}
          onClick={() => onPageChange(Math.max(0, currentPage - 1))}
          className="px-4 py-2 bg-white border border-blue-400 rounded-lg font-bold text-black disabled:opacity-40 hover:bg-blue-50 cursor-pointer"
        >
          Poprzednia
        </button>
        <span className="font-bold text-sm text-black">
          Strona {currentPage + 1} z {totalPages} (łącznie: {totalCount}, po {PAGE_SIZE} na stronę)
        </span>
        <button
          disabled={currentPage + 1 >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="px-4 py-2 bg-white border border-blue-400 rounded-lg font-bold text-black disabled:opacity-40 hover:bg-blue-50 cursor-pointer"
        >
          Następna
        </button>
      </div>
    </>
  );
}
