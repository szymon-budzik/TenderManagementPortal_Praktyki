import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import { Trash2, Plus, Pencil, Check, X, KeyRound, ArrowUpDown } from 'lucide-react';

export function parseKeywordsString(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((item) => {
      let current = item;
      let isWildcard = false;

      if (current.toUpperCase().endsWith(':WILDCARD')) {
        isWildcard = true;
        current = current.substring(0, current.length - ':WILDCARD'.length).trim();
      }

      const idx = current.lastIndexOf(':');
      if (idx > 0) {
        const word = current.substring(0, idx).trim();
        const val = current.substring(idx + 1).trim().toUpperCase();
        if (val === 'EXCLUDED') {
          return { word, score: 50, isExcluded: true, isWildcard };
        }
        const parsedScore = parseInt(val, 10);
        return {
          word,
          score: Number.isNaN(parsedScore) ? 50 : Math.max(1, Math.min(100, parsedScore)),
          isExcluded: false,
          isWildcard,
        };
      }
      return { word: current, score: 50, isExcluded: false, isWildcard };
    });
}

export function serializeKeywordsList(list) {
  return list
    .map(
      (k) =>
        `${k.word.trim()}:${k.isExcluded ? 'EXCLUDED' : k.score}${
          k.isWildcard ? ':WILDCARD' : ''
        }`
    )
    .join(', ');
}

export default function KeywordsView() {
  const [categories, setCategories] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'name', dir: 'asc' });
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [name, setName] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');

  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatName, setEditCatName] = useState('');
  const [addingWordCatId, setAddingWordCatId] = useState(null);
  const [newWordsText, setNewWordsText] = useState('');

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

  const toggleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedCategories = useMemo(() => {
    const copy = [...categories];
    copy.sort((a, b) => {
      const { key, dir } = sortConfig;
      const mult = dir === 'asc' ? 1 : -1;
      return String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'pl') * mult;
    });
    return copy;
  }, [categories, sortConfig]);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!keywordsInput.trim()) return;

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
      console.error('Błąd tworzenia kategorii:', err);
    }
  };

  const handleSelectKeyword = (cat, index, kwObj) => {
    setSelectedKeyword({
      catId: cat.id,
      catName: cat.name,
      wordIndex: index,
      word: kwObj.word,
      score: kwObj.score,
      isExcluded: kwObj.isExcluded,
      isWildcard: Boolean(kwObj.isWildcard),
    });
  };

  const handleToggleWildcard = (checked) => {
    setSelectedKeyword((prev) => {
      if (!prev) return prev;
      let nextWord = prev.word.trim();
      if (checked && nextWord && !nextWord.endsWith('*')) {
        nextWord = `${nextWord}*`;
      }
      return {
        ...prev,
        word: nextWord,
        isWildcard: checked,
      };
    });
  };

  const handleSaveSelectedKeyword = async () => {
    if (!selectedKeyword || !selectedKeyword.word.trim()) return;
    const cat = categories.find((c) => c.id === selectedKeyword.catId);
    if (!cat) return;

    const list = parseKeywordsString(cat.keywords);
    if (!list[selectedKeyword.wordIndex]) return;

    list[selectedKeyword.wordIndex] = {
      word: selectedKeyword.word.trim(),
      score: selectedKeyword.isExcluded ? 50 : Number(selectedKeyword.score),
      isExcluded: Boolean(selectedKeyword.isExcluded),
      isWildcard: Boolean(selectedKeyword.isWildcard),
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
      console.error('Błąd zapisu słowa:', err);
    }
  };

  const confirmRemoveSingleKeyword = () => {
    if (!selectedKeyword) return;
    const cat = categories.find((c) => c.id === selectedKeyword.catId);
    if (!cat) return;

    const list = parseKeywordsString(cat.keywords);
    if (list.length <= 1) return;

    setConfirmDialog({
      title: 'Usuń słowo kluczowe',
      message: `Czy na pewno chcesz usunąć słowo "${selectedKeyword.word}" z kategorii "${cat.name}"?`,
      onConfirm: async () => {
        try {
          const nextList = list.filter((_, idx) => idx !== selectedKeyword.wordIndex);
          await api.put(`/keywords/${cat.id}`, {
            name: cat.name,
            keywords: serializeKeywordsList(nextList),
            score: 50,
            isExcluded: false,
          });
          setSelectedKeyword(null);
          fetchCategories();
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleAddWordsToCategory = async (cat) => {
    if (!newWordsText.trim()) return;
    const existing = parseKeywordsString(cat.keywords);
    const added = newWordsText
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean)
      .map((w) => ({ word: w, score: 50, isExcluded: false, isWildcard: false }));

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
      console.error('Błąd dodawania słów:', err);
    }
  };

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
      console.error('Błąd zmiany nazwy:', err);
    }
  };

  const confirmDeleteCategory = (cat) => {
    setConfirmDialog({
      title: 'Usuń kategorię słów kluczowych',
      message: `Czy na pewno chcesz usunąć kategorię "${cat.name}" wraz ze wszystkimi jej słowami?`,
      onConfirm: async () => {
        try {
          await api.delete(`/keywords/${cat.id}`);
          if (selectedKeyword?.catId === cat.id) setSelectedKeyword(null);
          fetchCategories();
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const previewWords = keywordsInput
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);

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

      <div className="flex items-center gap-2">
        <KeyRound size={24} className="text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-black">Kategorie i Wagi Słów Kluczowych</h2>
          <p className="text-xs font-semibold text-black">
            Utwórz kategorię ze słowami kluczowymi (np. dostaw*), a następnie kliknij słowo na liście, aby ustawić wagę (1–100), odmianę końcówek (*) lub wykluczenie.
          </p>
        </div>
      </div>

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
              placeholder="np. IT, Frontend, Logistyka"
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
              placeholder="np. oprogramowanie, dostaw*, python"
              className="w-full px-3.5 py-2.5 border border-blue-300 rounded-lg text-black font-mono text-sm focus:outline-none focus:border-blue-600"
            />
            {previewWords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {previewWords.map((w, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 bg-slate-200 border border-slate-400 rounded text-xs font-bold text-black"
                  >
                    {w}: 50
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

      {/* Panel konfiguracji klikniętego słowa kluczowego */}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start bg-slate-50 p-4 rounded-xl border border-blue-200">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase mb-1 text-black">
                  Treść słowa kluczowego
                </label>
                <input
                  type="text"
                  value={selectedKeyword.word}
                  onChange={(e) =>
                    setSelectedKeyword({ ...selectedKeyword, word: e.target.value })
                  }
                  placeholder="np. dostaw*"
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-black font-mono text-sm font-bold"
                />
              </div>

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
                        : selectedKeyword.isWildcard
                        ? 'bg-purple-600 border-purple-900 text-white'
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
                      : selectedKeyword.isWildcard
                      ? 'bg-purple-200 accent-purple-600 cursor-pointer'
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
            </div>

            <div className="flex flex-col justify-between gap-3">
              {/* Opcja Odmiana końcówek (Wildcard *) */}
              <label className="flex items-start gap-2.5 p-3 bg-purple-50 rounded-xl border-2 border-purple-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedKeyword.isWildcard}
                  onChange={(e) => handleToggleWildcard(e.target.checked)}
                  className="w-5 h-5 mt-0.5 accent-purple-700 cursor-pointer shrink-0"
                />
                <div>
                  <div className="font-extrabold text-sm text-black">
                    Odmiana końcówek (Wildcard *)
                  </div>
                  <div className="text-xs font-medium text-black/80 mt-0.5">
                    Gdy słowo kończy się na <span className="font-mono font-bold">*</span> (np.{' '}
                    <span className="font-mono font-bold">dostaw*</span>), dopasowuje dowolne końcówki: dostawa, dostawy, dostawie, dostawę.
                  </div>
                </div>
              </label>

              {/* Opcja Wyklucz */}
              <label className="flex items-start gap-2.5 p-3 bg-white rounded-xl border-2 border-red-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedKeyword.isExcluded}
                  onChange={(e) =>
                    setSelectedKeyword({ ...selectedKeyword, isExcluded: e.target.checked })
                  }
                  className="w-5 h-5 mt-0.5 accent-red-600 cursor-pointer shrink-0"
                />
                <div>
                  <div className="font-extrabold text-sm text-black">
                    Wyklucz to słowo
                  </div>
                  <div className="text-xs font-medium text-black/80 mt-0.5">
                    Oznacza słowo na czerwono i odrzuca cały przetarg zawierający to słowo.
                  </div>
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={confirmRemoveSingleKeyword}
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

      <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-blue-600 text-white select-none">
              <th
                onClick={() => toggleSort('name')}
                className="p-3.5 font-bold w-64 cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  Nazwa kategorii <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('keywords')}
                className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  Słowa kluczowe (Kliknij w słowo, aby skonfigurować wagę, wildcard * lub wykluczenie){' '}
                  <ArrowUpDown size={14} />
                </div>
              </th>
              <th className="p-3.5 font-bold text-right w-44">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100">
            {sortedCategories.length === 0 ? (
              <tr>
                <td colSpan="3" className="p-6 text-center font-medium">
                  Brak zdefiniowanych kategorii słów kluczowych.
                </td>
              </tr>
            ) : (
              sortedCategories.map((cat) => {
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

                          let badgeStyle =
                            'bg-blue-50 hover:bg-blue-100 border-blue-400 text-black';
                          if (kw.isExcluded) {
                            badgeStyle =
                              'bg-red-400 hover:bg-red-500 border-red-800 text-black';
                          } else if (kw.isWildcard) {
                            badgeStyle = isSelected
                              ? 'bg-purple-600 border-purple-900 text-white'
                              : 'bg-purple-300 hover:bg-purple-400 border-purple-800 text-black';
                          } else if (isSelected) {
                            badgeStyle = 'bg-blue-600 border-blue-900 text-white';
                          }

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSelectKeyword(cat, idx, kw)}
                              title={
                                kw.isExcluded
                                  ? kw.isWildcard
                                    ? 'Wykluczone + Odmiana końcówek (*)'
                                    : 'Słowo wykluczające'
                                  : kw.isWildcard
                                  ? 'Odmiana końcówek (Wildcard *) — dopasowuje różne końcówki'
                                  : 'Kliknij, aby skonfigurować'
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border-2 transition transform active:scale-95 cursor-pointer ${badgeStyle}`}
                            >
                              {kw.isExcluded
                                ? `${kw.word} (WYKLUCZ)`
                                : `${kw.word}: ${kw.score}`}
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
                            placeholder="np. docker, dostaw*"
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
                          onClick={() => confirmDeleteCategory(cat)}
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