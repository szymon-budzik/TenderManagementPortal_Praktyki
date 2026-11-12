import { useState, useEffect } from 'react';
import api from '../api';
import { Trash2, Plus, Pencil, Check, X, KeyRound, AlertCircle } from 'lucide-react';

export default function KeywordsView() {
  const [categories, setCategories] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Formularz nowej kategorii
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [score, setScore] = useState(50);
  const [isExcluded, setIsExcluded] = useState(false);

  // Stan edycji istniejącej kategorii
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchCategories = async () => {
    try {
      const res = await api.get('/keywords');
      setCategories(res.data || []);
    } catch (err) {
      console.error('Błąd pobierania kategorii słów kluczowych:', err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Walidacja: jedno słowo/fraza OK, ale wiele słów musi być rozdzielonych przecinkiem
  const validateKeywordsInput = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return 'Wpisz przynajmniej jedno słowo kluczowe.';
    }
    const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) {
      return 'Wpisz poprawne słowa kluczowe rozdzielone przecinkiem.';
    }
    // Jeśli nie ma przecinka, a wpisano >= 3 słowa oddzielone spacją, wymuś przecinki
    if (!trimmed.includes(',') && trimmed.split(/\s+/).length >= 3) {
      return 'Wiele słów kluczowych należy rozdzielić przecinkiem (np. java, spring, docker).';
    }
    return null;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const validationError = validateKeywordsInput(keywords);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    try {
      await api.post('/keywords', {
        name: name.trim(),
        keywords: keywords.trim(),
        score: isExcluded ? 1 : Number(score),
        isExcluded,
      });
      setName('');
      setKeywords('');
      setScore(50);
      setIsExcluded(false);
      fetchCategories();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Błąd podczas zapisywania kategorii.');
    }
  };

  const startEdit = (cat) => {
    setErrorMsg('');
    setEditingId(cat.id);
    setEditForm({
      name: cat.name,
      keywords: cat.keywords,
      score: cat.score || 50,
      isExcluded: Boolean(cat.isExcluded),
    });
  };

  const saveEdit = async (id) => {
    setErrorMsg('');
    const validationError = validateKeywordsInput(editForm.keywords || '');
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    try {
      await api.put(`/keywords/${id}`, {
        name: editForm.name.trim(),
        keywords: editForm.keywords.trim(),
        score: editForm.isExcluded ? 1 : Number(editForm.score),
        isExcluded: editForm.isExcluded,
      });
      setEditingId(null);
      fetchCategories();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Błąd aktualizacji kategorii.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Czy na pewno chcesz usunąć tę kategorię słów kluczowych?')) return;
    await api.delete(`/keywords/${id}`);
    fetchCategories();
  };

  const parsedPreview = keywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6 text-black">
      <div className="flex items-center gap-2">
        <KeyRound size={24} className="text-blue-600" />
        <h2 className="text-2xl font-bold text-black">Kategorie Słów Kluczowych (Keywordsy)</h2>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-4 bg-red-100 border-2 border-red-600 rounded-xl text-black font-bold text-sm">
          <AlertCircle size={18} className="text-red-700 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Formularz dodawania kategorii */}
      <form
        onSubmit={handleCreate}
        className="bg-white p-6 rounded-xl border border-blue-200 space-y-5 shadow-xs"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lewa kolumna: Nazwa kategorii + Słowa kluczowe */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Nazwa kategorii</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Rozwój Oprogramowania lub Branża Budowlana"
                className="w-full px-3.5 py-2 border border-blue-300 rounded-lg text-black font-semibold focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Słowa kluczowe (rozdzielone przecinkami)
              </label>
              <textarea
                rows={3}
                required
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="np. java, spring boot, react, system informatyczny"
                className="w-full px-3.5 py-2 border border-blue-300 rounded-lg text-black font-mono text-sm focus:outline-none focus:border-blue-600"
              />
              {parsedPreview.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {parsedPreview.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-blue-50 border border-blue-300 rounded text-xs font-bold text-black"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Prawa kolumna: Suwak 1-100 + Checkbox Wyklucz */}
          <div className="flex flex-col justify-between bg-slate-50 p-4 rounded-xl border border-blue-100">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label
                  className={`text-xs font-bold uppercase ${
                    isExcluded ? 'text-gray-400' : 'text-black'
                  }`}
                >
                  Waga punktowa (Scoring: 1–100)
                </label>
                <span
                  className={`px-3 py-1 rounded-lg text-sm font-extrabold border ${
                    isExcluded
                      ? 'bg-gray-200 border-gray-400 text-gray-500'
                      : 'bg-blue-600 border-blue-700 text-white'
                  }`}
                >
                  {isExcluded ? 'Wyłączony' : `${score} pkt`}
                </span>
              </div>

              <input
                type="range"
                min="1"
                max="100"
                disabled={isExcluded}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className={`w-full h-2.5 rounded-lg appearance-none ${
                  isExcluded
                    ? 'bg-gray-300 accent-gray-400 opacity-45 cursor-not-allowed'
                    : 'bg-blue-200 accent-blue-600 cursor-pointer'
                }`}
              />
              <div
                className={`flex justify-between text-xs font-bold ${
                  isExcluded ? 'text-gray-400' : 'text-black'
                }`}
              >
                <span>1 pkt</span>
                <span>50 pkt</span>
                <span>100 pkt</span>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-blue-200 flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isExcluded}
                  onChange={(e) => setIsExcluded(e.target.checked)}
                  className="w-5 h-5 accent-red-600 cursor-pointer"
                />
                <span className="font-extrabold text-sm text-black">
                  Wyklucz (odrzuca przetarg po dopasowaniu)
                </span>
              </label>

              <button
                type="submit"
                className="flex items-center gap-1.5 py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
              >
                <Plus size={16} /> Dodaj Kategorię
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Tabela zapisanych kategorii */}
      <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="p-3.5 font-bold">Nazwa kategorii</th>
              <th className="p-3.5 font-bold">Słowa kluczowe</th>
              <th className="p-3.5 font-bold">Scoring / Tryb</th>
              <th className="p-3.5 font-bold text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100">
            {categories.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-6 text-center font-medium">
                  Brak zdefiniowanych kategorii słów kluczowych.
                </td>
              </tr>
            ) : (
              categories.map((cat) => {
                const isEditing = editingId === cat.id;
                const wordsList = (cat.keywords || '')
                  .split(',')
                  .map((w) => w.trim())
                  .filter(Boolean);

                return (
                  <tr key={cat.id} className="hover:bg-blue-50/50">
                    <td className="p-3.5 font-bold align-top">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-blue-400 rounded bg-white text-black"
                        />
                      ) : (
                        cat.name
                      )}
                    </td>

                    <td className="p-3.5 align-top">
                      {isEditing ? (
                        <textarea
                          rows={2}
                          value={editForm.keywords}
                          onChange={(e) => setEditForm({ ...editForm, keywords: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-blue-400 rounded bg-white text-black font-mono text-xs"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {wordsList.map((w, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-0.5 bg-blue-50 border border-blue-300 rounded-md text-xs font-bold text-black"
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="p-3.5 align-top">
                      {isEditing ? (
                        <div className="space-y-2 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="1"
                              max="100"
                              disabled={editForm.isExcluded}
                              value={editForm.score}
                              onChange={(e) =>
                                setEditForm({ ...editForm, score: Number(e.target.value) })
                              }
                              className={`w-full ${
                                editForm.isExcluded
                                  ? 'opacity-40 cursor-not-allowed accent-gray-400'
                                  : 'accent-blue-600 cursor-pointer'
                              }`}
                            />
                            <span className="text-xs font-extrabold whitespace-nowrap">
                              {editForm.isExcluded ? '—' : `${editForm.score} pkt`}
                            </span>
                          </div>
                          <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.isExcluded}
                              onChange={(e) =>
                                setEditForm({ ...editForm, isExcluded: e.target.checked })
                              }
                              className="accent-red-600"
                            />
                            Wyklucz
                          </label>
                        </div>
                      ) : cat.isExcluded ? (
                        <span className="inline-block px-3 py-1 rounded-lg text-xs font-extrabold bg-red-400 border-2 border-red-800 text-black">
                          WYKLUCZ
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 rounded-lg text-xs font-extrabold bg-blue-100 border-2 border-blue-600 text-black">
                          +{cat.score} pkt
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-right whitespace-nowrap align-top">
                      <div className="flex items-center justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(cat.id)}
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
                              onClick={() => startEdit(cat)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <Pencil size={14} /> Edytuj
                            </button>
                            <button
                              onClick={() => handleDelete(cat.id)}
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
    </div>
  );
}