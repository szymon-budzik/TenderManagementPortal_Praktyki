import { useState, useEffect } from 'react';
import api from '../api';
import { Trash2, Plus, Pencil, Check, X, Lightbulb, CheckCircle2, XCircle } from 'lucide-react';

const PAGE_SIZE = 5;

export default function EndpointsView() {
  const [endpoints, setEndpoints] = useState([]);
  const [page, setPage] = useState(0);

  const [newEndpoint, setNewEndpoint] = useState({
    name: '',
    url: '',
    httpMethod: 'GET',
    payload: '',
    isActive: true,
  });

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [testingId, setTestingId] = useState(null);
  const [banner, setBanner] = useState(null);

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

  const totalPages = Math.max(1, Math.ceil(endpoints.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedEndpoints = endpoints.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    setBanner(null);
    try {
      await api.post('/admin/endpoints', {
        ...newEndpoint,
        name: newEndpoint.name.trim(),
        url: newEndpoint.url.trim(),
        payload: newEndpoint.payload.trim() || null,
      });
      setNewEndpoint({ name: '', url: '', httpMethod: 'GET', payload: '', isActive: true });
      setBanner({
        type: 'success',
        title: 'Dodano źródło',
        text: 'Nowy endpoint / scraper został zapisany w bazie danych.',
      });
      fetchEndpoints();
    } catch (err) {
      setBanner({
        type: 'error',
        title: 'Błąd dodawania źródła',
        text: err.response?.data?.message || 'Sprawdź poprawność adresu URL i spróbuj ponownie.',
      });
    }
  };

  const handleToggleActive = async (ep) => {
    setBanner(null);
    try {
      await api.put(`/admin/endpoints/${ep.id}`, {
        ...ep,
        isActive: !ep.isActive,
      });
      fetchEndpoints();
    } catch {
      setBanner({
        type: 'error',
        title: 'Błąd zmiany statusu',
        text: 'Nie udało się zmienić statusu źródła.',
      });
    }
  };

  const startEdit = (ep) => {
    setEditingId(ep.id);
    setEditForm({
      name: ep.name,
      url: ep.url,
      httpMethod: ep.httpMethod,
      payload: ep.payload || '',
      isActive: ep.isActive,
    });
  };

  const saveEdit = async (id) => {
    setBanner(null);
    try {
      await api.put(`/admin/endpoints/${id}`, {
        ...editForm,
        payload: editForm.payload.trim() || null,
      });
      setEditingId(null);
      setBanner({
        type: 'success',
        title: 'Zapisano zmiany',
        text: 'Konfiguracja źródła została zaktualizowana.',
      });
      fetchEndpoints();
    } catch (err) {
      setBanner({
        type: 'error',
        title: 'Błąd zapisu',
        text: err.response?.data?.message || 'Nie udało się zapisać zmian endpointu.',
      });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Czy na pewno chcesz usunąć to źródło?')) return;
    setBanner(null);
    await api.delete(`/admin/endpoints/${id}`);
    fetchEndpoints();
  };

  const handleTestConnection = async (ep) => {
    setTestingId(ep.id);
    setBanner(null);
    try {
      const res = await api.post(`/admin/endpoints/${ep.id}/test`);
      const data = res.data;
      setBanner({
        type: data.success ? 'success' : 'error',
        title: `Test połączenia (bez pobierania przetargów): ${ep.name}`,
        text: data.message,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        title: `Test połączenia: ${ep.name}`,
        text: err.response?.data?.message || 'Nie udało się wykonać testu połączenia.',
      });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6 text-black">
      <h2 className="text-2xl font-bold text-black">Zarządzanie Źródłami Danych (API i Web Scraper)</h2>

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
            className="p-1 rounded-lg hover:bg-black/10 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="bg-white p-4 rounded-xl border border-blue-200 grid grid-cols-1 md:grid-cols-6 gap-3 items-end shadow-xs"
      >
        <div>
          <label className="block text-xs font-bold uppercase mb-1">Nazwa źródła</label>
          <input
            type="text"
            required
            value={newEndpoint.name}
            onChange={(e) => setNewEndpoint({ ...newEndpoint, name: e.target.value })}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black"
            placeholder="np. Portal BIP / BZP"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase mb-1">URL Endpointu / Strony WWW</label>
          <input
            type="url"
            required
            value={newEndpoint.url}
            onChange={(e) => setNewEndpoint({ ...newEndpoint, url: e.target.value })}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black"
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase mb-1">Tryb / Metoda</label>
          <select
            value={newEndpoint.httpMethod}
            onChange={(e) => setNewEndpoint({ ...newEndpoint, httpMethod: e.target.value })}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-black font-semibold"
          >
            <option value="GET">API GET</option>
            <option value="POST">API POST</option>
            <option value="SCRAPER">SCRAPER (BS4 + Pandas)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase mb-1">
            {newEndpoint.httpMethod === 'SCRAPER' ? 'Selektor CSS (opcj.)' : 'Payload JSON (opcj.)'}
          </label>
          <input
            type="text"
            value={newEndpoint.payload}
            onChange={(e) => setNewEndpoint({ ...newEndpoint, payload: e.target.value })}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black font-mono text-xs"
            placeholder={
              newEndpoint.httpMethod === 'SCRAPER'
                ? 'np. table, tr, .tender-row'
                : '{"PageSize": 25}'
            }
          />
        </div>
        <button
          type="submit"
          className="flex items-center justify-center gap-1.5 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
        >
          <Plus size={16} /> Dodaj Źródło
        </button>
      </form>

      <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="p-3.5 font-bold">Nazwa</th>
              <th className="p-3.5 font-bold">Tryb</th>
              <th className="p-3.5 font-bold">URL i Parametry</th>
              <th className="p-3.5 font-bold">Status (Kliknij, aby zmienić)</th>
              <th className="p-3.5 font-bold text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100">
            {paginatedEndpoints.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-6 text-center font-medium text-black">
                  Brak dodanych źródeł. Dodaj pierwszy endpoint API lub Web Scraper powyżej.
                </td>
              </tr>
            ) : (
              paginatedEndpoints.map((ep) => {
                const isEditing = editingId === ep.id;

                return (
                  <tr key={ep.id} className="hover:bg-blue-50/50">
                    <td className="p-3.5 font-bold">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-2.5 py-1 border border-blue-400 rounded bg-white text-black"
                        />
                      ) : (
                        ep.name
                      )}
                    </td>
                    <td className="p-3.5 font-mono font-bold">
                      {isEditing ? (
                        <select
                          value={editForm.httpMethod}
                          onChange={(e) => setEditForm({ ...editForm, httpMethod: e.target.value })}
                          className="px-2.5 py-1 border border-blue-400 rounded bg-white text-black"
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
                              : 'bg-blue-100 border-blue-500 text-black'
                          }`}
                        >
                          {ep.httpMethod}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-xs break-all">
                      {isEditing ? (
                        <div className="space-y-1.5">
                          <input
                            type="url"
                            value={editForm.url}
                            onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                            className="w-full px-2.5 py-1 border border-blue-400 rounded bg-white text-black"
                          />
                          <input
                            type="text"
                            value={editForm.payload}
                            onChange={(e) => setEditForm({ ...editForm, payload: e.target.value })}
                            placeholder="Payload JSON lub Selektor CSS"
                            className="w-full px-2.5 py-1 border border-blue-300 rounded bg-white text-black"
                          />
                        </div>
                      ) : (
                        <div>
                          <div>{ep.url}</div>
                          {ep.payload && (
                            <div className="text-[11px] text-black mt-1 bg-blue-50/80 p-1 rounded border border-blue-200">
                              {ep.httpMethod === 'SCRAPER' ? 'Selektor CSS: ' : 'Payload: '}
                              {ep.payload}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(ep)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold border-2 shadow-xs transition transform active:scale-95 cursor-pointer ${
                          ep.isActive
                            ? 'bg-green-400 hover:bg-green-500 border-green-800 text-black'
                            : 'bg-red-400 hover:bg-red-500 border-red-800 text-black'
                        }`}
                      >
                        {ep.isActive ? 'AKTYWNY' : 'WYŁĄCZONY'}
                      </button>
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleTestConnection(ep)}
                          disabled={testingId === ep.id}
                          title="Sprawdź połączenie (nie pobiera przetargów do bazy)"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 border-2 border-amber-500 text-black rounded-lg font-bold text-xs cursor-pointer transition"
                        >
                          <Lightbulb size={15} className={testingId === ep.id ? 'animate-pulse' : ''} />
                          {testingId === ep.id ? 'Test...' : 'Testuj'}
                        </button>

                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(ep.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <Check size={14} /> Zapisz
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-blue-300 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <X size={14} /> Anuluj
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(ep)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <Pencil size={14} /> Edytuj
                            </button>
                            <button
                              onClick={() => handleDelete(ep.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 hover:bg-red-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <Trash2 size={14} /> Usuń
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

      {/* Paginacja */}
      <div className="flex items-center justify-between">
        <button
          disabled={currentPage === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="px-4 py-2 bg-white border border-blue-400 rounded-lg font-bold text-black disabled:opacity-40 hover:bg-blue-50 cursor-pointer"
        >
          Poprzednia
        </button>
        <span className="font-bold text-sm text-black">
          Strona {currentPage + 1} z {totalPages} (łącznie: {endpoints.length})
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