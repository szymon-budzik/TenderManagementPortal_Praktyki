import { useState, useEffect } from 'react';
import api from '../api';
import { Trash2, Plus, Pencil, Check, X, KeyRound, AlertCircle } from 'lucide-react';

// Pomocnicza funkcja parsująca "oprogramowanie:50, java:60, python:EXCLUDED"
export function parseKeywordsString(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((item) => {
      const idx = item.lastIndexOf(':');
      if (idx > 0) {
        const word = item.substring(0, idx).trim();
        const val = item.substring(idx + 1).trim().toUpperCase();
        if (val === 'EXCLUDED') {
          return { word, score: 50, isExcluded: true };
        }
        const parsedScore = parseInt(val, 10);
        return {
          word,
          score: Number.isNaN(parsedScore) ? 50 : Math.max(1, Math.min(100, parsedScore)),
          isExcluded: false,
        };
      }
      return { word: item, score: 50, isExcluded: false };
    });
}

export function serializeKeywordsList(list) {
  return list
    .map((k) => `${k.word.trim()}:${k.isExcluded ? 'EXCLUDED' : k.score}`)
    .join(', ');
}

export default function KeywordsView() {
  const [categories, setCategories] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Formularz tworzenia nowej kategorii (tylko nazwa + słowa po przecinku)
  const [name, setName] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');

  // Edycja nazwy kategorii lub dodanie nowego słowa
  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatName, setEditCatName] = useState('');
  const [addingWordCatId, setAddingWordCatId] = useState(null);
  const [newWordsText, setNewWordsText] = useState('');

  // Aktywnie kliknięte słowo kluczowe do ustawienia wagi 1-100 lub wykluczenia
  // { catId, wordIndex, word, score, isExcluded }
  const [selectedKeyword, setSelectedKeyword] = useState(null);

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

  const validateRawWords = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return 'Wpisz przynajmniej jedno słowo kluczowe.';
    }
    if (!trimmed.includes(',') && trimmed.split(/\s+/).length >= 3) {
      return 'Wiele słów kluczowych należy rozdzielić przecinkiem (np. oprogramowanie, java, python).';
    }
    return null;
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const validationError = validateRawWords(keywordsInput);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    const words = keywordsInput
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean)
      .map((w) => (w.includes(':') ? w : `${w}:50`))
      .join(', ');

    try {
      await api.post('/keywords', {
        name: name.trim(),
        keywords: words,
        score: 50,
        isExcluded: false,
      });
      setName('');
      setKeywordsInput('');
      fetchCategories();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Błąd podczas tworzenia kategorii.');
    }
  };

  // Kliknięcie w konkretne słowo kluczowe w tabeli
  const handleSelectKeyword = (cat, index, kwObj) => {
    setErrorMsg('');
    setSelectedKeyword({
      catId: cat.id,
      catName: cat.name,
      wordIndex: index,
      word: kwObj.word,
      score: kwObj.score,
      isExcluded: kwObj.isExcluded,
    });
  };

  // Zapisanie wagi (1-100) lub wykluczenia dla klikniętego słowa
  const handleSaveSelectedKeyword = async () => {
    if (!selectedKeyword) return;
    const cat = categories.find((c) => c.id === selectedKeyword.catId);
    if (!cat) return;

    const list = parseKeywordsString(cat.keywords);
    if (!list[selectedKeyword.wordIndex]) return;

    list[selectedKeyword.wordIndex] = {
      word: selectedKeyword.word.trim(),
      score: selectedKeyword.isExcluded ? 50 : Number(selectedKeyword.score),
      isExcluded: Boolean(selectedKeyword.isExcluded),
    };

    try {
      await api.put(`/keywords/${cat.id}`, {
        name: cat.name,
        keywords: serializeKeywordsList(list),
        score: 50,
        isExcluded: false,
      });
      setSelectedKeyword(null);
      fetchCategories();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Błąd zapisywania wagi słowa kluczowego.');
    }
  };

  // Usunięcie pojedynczego słowa z kategorii
  const handleRemoveSingleKeyword = async () => {
    if (!selectedKeyword) return;
    const cat = categories.find((c) => c.id === selectedKeyword.catId);
    if (!cat) return;

    const list = parseKeywordsString(cat.keywords);
    if (list.length <= 1) {
      setErrorMsg('Kategoria musi posiadać przynajmniej jedno słowo kluczowe.');
      return;
    }

    const nextList = list.filter((_, idx) => idx !== selectedKeyword.wordIndex);
    try {
      await api.put(`/keywords/${cat.id}`, {
        name: cat.name,
        keywords: serializeKeywordsList(nextList),
        score: 50,
        isExcluded: false,
      });
      setSelectedKeyword(null);
      fetchCategories();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Błąd podczas usuwania słowa.');
    }
  };

  // Dodanie nowych słów do istniejącej kategorii
  const handleAddWordsToCategory = async (cat) => {
    setErrorMsg('');
    const validationError = validateRawWords(newWordsText);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    const existing = parseKeywordsString(cat.keywords);
    const added = newWordsText
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean)
      .map((w) => ({ word: w, score: 50, isExcluded: false }));

    const combined = [...existing, ...added];
    try {
      await api.put(`/keywords/${cat.id}`, {
        name: cat.name,
        keywords: serializeKeywordsList(combined),
        score: 50,
        isExcluded: false,
      });
      setAddingWordCatId(null);
      setNewWordsText('');
      fetchCategories();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Błąd dodawania słów do kategorii.');
    }
  };

  // Zmiana samej nazwy kategorii
  const handleSaveCategoryName = async (cat) => {
    if (!editCatName.trim()) return;
    try {
      await api.put(`/keywords/${cat.id}`, {
        name: editCatName.trim(),
        keywords: cat.keywords,
        score: 50,
        isExcluded: false,
      });
      setEditingCatId(null);
      fetchCategories();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Błąd zmiany nazwy kategorii.');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('Czy na pewno chcesz usunąć całą kategorię słów kluczowych?')) return;
    await api.delete(`/keywords/${id}`);
    if (selectedKeyword?.catId === id) setSelectedKeyword(null);
    fetchCategories();
  };

  const previewWords = keywordsInput
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6 text-black">
      <div className="flex items-center gap-2">
        <KeyRound size={24} className="text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-black">Kategorie i Wagi Słów Kluczowych</h2>
          <p className="text-xs font-semibold text-black">
            Najpierw utwórz kategorię ze słowami kluczowymi, a następnie kliknij w wybrane słowo na liście poniżej, aby nadać mu wagę (1–100) lub wykluczyć.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-4 bg-red-100 border-2 border-red-600 rounded-xl text-black font-bold text-sm">
          <AlertCircle size={18} className="text-red-700 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KROK 1: Formularz dodawania kategorii (BEZ suwaka i BEZ checkboxa wykluczenia) */}
      <form
        onSubmit={handleCreateCategory}
        className="bg-white p-6 rounded-xl border border-blue-200 space-y-4 shadow-xs"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-4">
            <label className="block text-xs font-bold uppercase mb-1">Nazwa kategorii</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. IT, Frontend, Backend"
              className="w-full px-3.5 py-2.5 border border-blue-300 rounded-lg text-black font-semibold focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="md:col-span-6">
            <label className="block text-xs font-bold uppercase mb-1">
              Słowa kluczowe (rozdzielone przecinkami)
            </label>
            <input
              type="text"
              required
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              placeholder="np. oprogramowanie, java, python"
              className="w-full px-3.5 py-2.5 border border-blue-300 rounded-lg text-black font-mono text-sm focus:outline-none focus:border-blue-600"
            />
            {previewWords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {previewWords.map((w, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 bg-blue-50 border border-blue-300 rounded text-xs font-bold text-black"
                  >
                    {w}: 50 (domyślnie)
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2 md:pt-5">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
            >
              <Plus size={16} /> Dodaj Kategorię
            </button>
          </div>
        </div>
      </form>

      {/* KROK 2: Panel edycji klikniętego słowa kluczowego (Suwak 1-100 + Wyklucz) */}
      {selectedKeyword && (
        <div className="bg-white p-6 rounded-xl border-2 border-blue-600 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-blue-100 pb-3">
            <div>
              <span className="text-xs font-extrabold uppercase text-blue-700">
                Kategoria: {selectedKeyword.catName}
              </span>
              <h3 className="text-lg font-extrabold text-black">
                Konfiguracja słowa kluczowego:{' '}
                <span className="underline">{selectedKeyword.word}</span>
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedKeyword(null)}
              className="p-1.5 rounded-lg border border-blue-300 hover:bg-blue-50 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-slate-50 p-4 rounded-xl border border-blue-200">
            {/* Suwak 1-100 (wyszarzony i zablokowany, gdy zaznaczono Wyklucz) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  className={`text-xs font-extrabold uppercase ${
                    selectedKeyword.isExcluded ? 'text-gray-400' : 'text-black'
                  }`}
                >
                  Waga słowa kluczowego (1–100 pkt)
                </label>
                <span
                  className={`px-3 py-1 rounded-lg text-sm font-extrabold border ${
                    selectedKeyword.isExcluded
                      ? 'bg-gray-200 border-gray-400 text-gray-500'
                      : 'bg-blue-600 border-blue-800 text-white'
                  }`}
                >
                  {selectedKeyword.isExcluded ? 'Wyłączony' : `${selectedKeyword.score} pkt`}
                </span>
              </div>

              <input
                type="range"
                min="1"
                max="100"
                disabled={selectedKeyword.isExcluded}
                value={selectedKeyword.score}
                onChange={(e) =>
                  setSelectedKeyword({ ...selectedKeyword, score: Number(e.target.value) })
                }
                className={`w-full h-2.5 rounded-lg appearance-none ${
                  selectedKeyword.isExcluded
                    ? 'bg-gray-300 accent-gray-400 opacity-45 cursor-not-allowed'
                    : 'bg-blue-200 accent-blue-600 cursor-pointer'
                }`}
              />
              <div
                className={`flex justify-between text-xs font-bold ${
                  selectedKeyword.isExcluded ? 'text-gray-400' : 'text-black'
                }`}
              >
                <span>1 pkt</span>
                <span>50 pkt</span>
                <span>100 pkt</span>
              </div>
            </div>

            {/* Checkbox Wyklucz + Przyciski akcji */}
            <div className="flex flex-col justify-between gap-4">
              <label className="flex items-center gap-2.5 p-3 bg-white rounded-xl border-2 border-red-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedKeyword.isExcluded}
                  onChange={(e) =>
                    setSelectedKeyword({ ...selectedKeyword, isExcluded: e.target.checked })
                  }
                  className="w-5 h-5 accent-red-600 cursor-pointer"
                />
                <span className="font-extrabold text-sm text-black">
                  Wyklucz to słowo (oznacza na czerwono i odrzuca cały przetarg)
                </span>
              </label>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleRemoveSingleKeyword}
                  className="flex items-center gap-1 px-3.5 py-2 bg-white border border-red-400 hover:bg-red-50 text-black font-bold rounded-lg text-xs cursor-pointer"
                >
                  <Trash2 size={14} /> Usuń słowo
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedKeyword(null)}
                  className="px-3.5 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-black font-bold rounded-lg text-xs cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={handleSaveSelectedKeyword}
                  className="flex items-center gap-1 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-xs cursor-pointer"
                >
                  <Check size={15} /> Zapisz słowo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabela kategorii ze słowami kluczowymi */}
      <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="p-3.5 font-bold w-64">Nazwa kategorii</th>
              <th className="p-3.5 font-bold">
                Słowa kluczowe (Kliknij w słowo, aby zmienić wagę 1–100 lub wykluczyć)
              </th>
              <th className="p-3.5 font-bold text-right w-44">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100">
            {categories.length === 0 ? (
              <tr>
                <td colSpan="3" className="p-6 text-center font-medium">
                  Brak zdefiniowanych kategorii słów kluczowych. Dodaj pierwszą kategorię powyżej.
                </td>
              </tr>
            ) : (
              categories.map((cat) => {
                const parsedList = parseKeywordsString(cat.keywords);
                const isEditingName = editingCatId === cat.id;
                const isAddingWords = addingWordCatId === cat.id;

                return (
                  <tr key={cat.id} className="hover:bg-blue-50/40">
                    <td className="p-3.5 font-extrabold align-top">
                      {isEditingName ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editCatName}
                            onChange={(e) => setEditCatName(e.target.value)}
                            className="w-full px-2.5 py-1 border border-blue-400 rounded bg-white text-black font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveCategoryName(cat)}
                            className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCatId(null)}
                            className="p-1.5 bg-white border border-blue-300 rounded hover:bg-blue-50 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="text-base text-black">{cat.name}</div>
                      )}
                    </td>

                    <td className="p-3.5 align-top space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {parsedList.map((kw, idx) => {
                          const isSelected =
                            selectedKeyword?.catId === cat.id &&
                            selectedKeyword?.wordIndex === idx;

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSelectKeyword(cat, idx, kw)}
                              title="Kliknij, aby ustawić wagę lub wykluczyć"
                              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border-2 transition transform active:scale-95 cursor-pointer ${
                                kw.isExcluded
                                  ? 'bg-red-400 hover:bg-red-500 border-red-800 text-black'
                                  : isSelected
                                  ? 'bg-blue-600 border-blue-900 text-white'
                                  : 'bg-blue-50 hover:bg-blue-100 border-blue-400 text-black'
                              }`}
                            >
                              {kw.isExcluded ? `${kw.word} (WYKLUCZ)` : `${kw.word}: ${kw.score}`}
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => {
                            setAddingWordCatId(isAddingWords ? null : cat.id);
                            setNewWordsText('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white border border-dashed border-blue-500 hover:bg-blue-50 text-black cursor-pointer"
                        >
                          + Dodaj słowo
                        </button>
                      </div>

                      {isAddingWords && (
                        <div className="flex items-center gap-2 pt-1 max-w-md">
                          <input
                            type="text"
                            value={newWordsText}
                            onChange={(e) => setNewWordsText(e.target.value)}
                            placeholder="np. docker, kubernetes"
                            className="flex-1 px-2.5 py-1 border border-blue-400 rounded bg-white text-black text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddWordsToCategory(cat)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold cursor-pointer"
                          >
                            Dodaj
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddingWordCatId(null)}
                            className="px-2.5 py-1 bg-white border border-blue-300 rounded text-xs font-bold cursor-pointer"
                          >
                            Anuluj
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="p-3.5 text-right whitespace-nowrap align-top">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCatId(cat.id);
                            setEditCatName(cat.name);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                        >
                          <Pencil size={14} /> Nazwa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 hover:bg-red-50 text-black rounded-lg font-bold text-xs cursor-pointer"
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
  );
}