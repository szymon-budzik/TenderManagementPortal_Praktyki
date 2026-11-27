import { useState, useEffect, useCallback } from 'react';
import { KeyRound } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import ResourceAccessModal from './ResourceAccessModal';
import KeywordCategoryForm from './keywords/KeywordCategoryForm';
import KeywordConfigPanel from './keywords/KeywordConfigPanel';
import KeywordCategoriesTable from './keywords/KeywordCategoriesTable';
import KeywordColorModal from './keywords/KeywordColorModal';
import { DEFAULT_CATEGORY_COLOR } from './keywords/categoryColorPresets';
import {
  hasWildcardSuffix,
  parseKeywordsString,
  serializeKeywordsList,
} from './keywords/keywordUtils';
import {
  createKeywordCategory,
  deleteKeywordCategory,
  getKeywordCategories,
  updateKeywordCategory,
} from '../services/keywordsApi';
import { RESOURCE_TYPES, removeResourceAccess } from '../rolesStore';
import { useSort } from '../hooks/useSort';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

export default function KeywordsView() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [lightText, setLightText] = useState(false);

  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatName, setEditCatName] = useState('');
  const [addingWordCatId, setAddingWordCatId] = useState(null);
  const [newWordsText, setNewWordsText] = useState('');

  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [openBulkMenuCatId, setOpenBulkMenuCatId] = useState(null);
  const [accessModalCategory, setAccessModalCategory] = useState(null);
  const [colorModalCategory, setColorModalCategory] = useState(null);
  const [savingColor, setSavingColor] = useState(false);
  const [, setAccessTick] = useState(0);

  const { confirmDialog, openConfirm, closeConfirm } = useConfirmDialog();
  const { toggleSort, sortedItems: sortedCategories } = useSort(categories, {
    key: 'name',
    dir: 'asc',
  });

  const fetchCategories = useCallback(async () => {
    try {
      const data = await getKeywordCategories();
      setCategories(data);
    } catch (err) {
      console.error('Błąd pobierania kategorii słów kluczowych:', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getKeywordCategories()
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch((err) => {
        console.error('Błąd pobierania kategorii słów kluczowych:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openBulkMenuCatId !== null && !e.target.closest('[data-bulk-menu]')) {
        setOpenBulkMenuCatId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openBulkMenuCatId]);

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
      await createKeywordCategory({
        name: name.trim(),
        keywords: words,
        score: 50,
        isExcluded: false,
        color,
        lightText,
      });
      setName('');
      setKeywordsInput('');
      setColor(DEFAULT_CATEGORY_COLOR);
      setLightText(false);
      fetchCategories();
    } catch (err) {
      console.error('Błąd tworzenia kategorii:', err);
    }
  };

  const handleSaveCategoryColor = async (cat, nextColor, nextLightText) => {
    setSavingColor(true);
    try {
      await updateKeywordCategory(cat.id, {
        name: cat.name,
        keywords: cat.keywords,
        score: 50,
        isExcluded: false,
        color: nextColor,
        lightText: nextLightText,
      });
      setColorModalCategory(null);
      fetchCategories();
    } catch (err) {
      console.error('Błąd zapisu koloru kategorii:', err);
    } finally {
      setSavingColor(false);
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
      isWildcard: Boolean(kwObj.isWildcard && hasWildcardSuffix(kwObj.word)),
    });
  };

  const handleSelectedWordChange = (nextWord) => {
    setSelectedKeyword((prev) => {
      if (!prev) return prev;
      const canBeWildcard = hasWildcardSuffix(nextWord);
      return {
        ...prev,
        word: nextWord,
        isWildcard: canBeWildcard ? prev.isWildcard : false,
      };
    });
  };

  const handleToggleWildcard = (checked) => {
    setSelectedKeyword((prev) => {
      if (!prev) return prev;
      if (checked && !hasWildcardSuffix(prev.word)) return prev;
      return { ...prev, isWildcard: checked };
    });
  };

  const handleSaveSelectedKeyword = async () => {
    if (!selectedKeyword || !selectedKeyword.word.trim()) return;
    const cat = categories.find((c) => c.id === selectedKeyword.catId);
    if (!cat) return;

    const list = parseKeywordsString(cat.keywords);
    if (!list[selectedKeyword.wordIndex]) return;

    const cleanWord = selectedKeyword.word.trim();
    const validWildcard = Boolean(selectedKeyword.isWildcard && hasWildcardSuffix(cleanWord));

    list[selectedKeyword.wordIndex] = {
      word: cleanWord,
      score: selectedKeyword.isExcluded ? 50 : Number(selectedKeyword.score),
      isExcluded: Boolean(selectedKeyword.isExcluded),
      isWildcard: validWildcard,
    };

    try {
      await updateKeywordCategory(cat.id, {
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

  const handleBulkUpdateCategoryKeywords = async (cat, mode) => {
    const list = parseKeywordsString(cat.keywords);
    if (list.length === 0) {
      setOpenBulkMenuCatId(null);
      return;
    }

    const updatedList = list.map((kw) => {
      const canBeWildcard = hasWildcardSuffix(kw.word);
      if (mode === 'NEUTRAL') return { ...kw, isExcluded: false, isWildcard: false };
      if (mode === 'EXCLUDED') return { ...kw, isExcluded: true, isWildcard: false };
      if (mode === 'WILDCARD') {
        if (!canBeWildcard) return kw;
        return { ...kw, isExcluded: false, isWildcard: true };
      }
      if (!canBeWildcard) return kw;
      return { ...kw, isExcluded: true, isWildcard: true };
    });

    try {
      await updateKeywordCategory(cat.id, {
        name: cat.name,
        keywords: serializeKeywordsList(updatedList),
        score: 50,
        isExcluded: false,
      });
      setOpenBulkMenuCatId(null);
      if (selectedKeyword?.catId === cat.id) setSelectedKeyword(null);
      fetchCategories();
    } catch (err) {
      console.error('Błąd zbiorczej aktualizacji słów kluczowych:', err);
    }
  };

  const confirmRemoveSingleKeyword = () => {
    if (!selectedKeyword) return;
    const cat = categories.find((c) => c.id === selectedKeyword.catId);
    if (!cat) return;

    const list = parseKeywordsString(cat.keywords);
    if (list.length <= 1) return;

    openConfirm({
      title: 'Usuń słowo kluczowe',
      message: `Czy na pewno chcesz usunąć słowo "${selectedKeyword.word}" z kategorii "${cat.name}"?`,
      onConfirm: async () => {
        const nextList = list.filter((_, idx) => idx !== selectedKeyword.wordIndex);
        await updateKeywordCategory(cat.id, {
          name: cat.name,
          keywords: serializeKeywordsList(nextList),
          score: 50,
          isExcluded: false,
        });
        setSelectedKeyword(null);
        fetchCategories();
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

    try {
      await updateKeywordCategory(cat.id, {
        name: cat.name,
        keywords: serializeKeywordsList([...existing, ...added]),
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
      await updateKeywordCategory(cat.id, {
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
    openConfirm({
      title: 'Usuń kategorię słów kluczowych',
      message: `Czy na pewno chcesz usunąć kategorię "${cat.name}" wraz ze wszystkimi jej słowami?`,
      onConfirm: async () => {
        await deleteKeywordCategory(cat.id);
        removeResourceAccess(RESOURCE_TYPES.KEYWORD, cat.id);
        if (selectedKeyword?.catId === cat.id) setSelectedKeyword(null);
        fetchCategories();
      },
    });
  };

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
        isOpen={Boolean(accessModalCategory)}
        resourceType={RESOURCE_TYPES.KEYWORD}
        resourceTypeLabel="Kategoria słów kluczowych"
        resourceId={accessModalCategory?.id}
        resourceName={accessModalCategory?.name}
        usageHint="Wybierz, które role mogą korzystać z tej kategorii słów kluczowych w Wyszukiwarce oraz w profilach Automatyzacji."
        onClose={() => setAccessModalCategory(null)}
        onSaved={() => setAccessTick((t) => t + 1)}
      />

      <KeywordColorModal
        category={colorModalCategory}
        saving={savingColor}
        onSave={handleSaveCategoryColor}
        onClose={() => setColorModalCategory(null)}
      />

      <div className="flex items-center gap-2">
        <KeyRound size={24} className="text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-black">Kategorie i Wagi Słów Kluczowych</h2>
          <p className="text-xs font-semibold text-black">
            Wildcard (*) można włączyć wyłącznie dla słów zakończonych gwiazdką (np. dostaw*). Kolor kategorii jest używany w podświetlaniu słów kluczowych w szczegółach przetargu.
          </p>
        </div>
      </div>

      <KeywordCategoryForm
        name={name}
        onNameChange={setName}
        keywordsInput={keywordsInput}
        onKeywordsInputChange={setKeywordsInput}
        color={color}
        onColorChange={setColor}
        lightText={lightText}
        onLightTextChange={setLightText}
        onSubmit={handleCreateCategory}
      />

      <KeywordConfigPanel
        selectedKeyword={selectedKeyword}
        onWordChange={handleSelectedWordChange}
        onScoreChange={(score) => setSelectedKeyword((prev) => ({ ...prev, score }))}
        onToggleWildcard={handleToggleWildcard}
        onToggleExcluded={(isExcluded) =>
          setSelectedKeyword((prev) => ({ ...prev, isExcluded }))
        }
        onSave={handleSaveSelectedKeyword}
        onDelete={confirmRemoveSingleKeyword}
        onClose={() => setSelectedKeyword(null)}
      />

      <KeywordCategoriesTable
        categories={sortedCategories}
        selectedKeyword={selectedKeyword}
        editingCatId={editingCatId}
        editCatName={editCatName}
        onEditCatNameChange={setEditCatName}
        onStartEditName={(cat) => {
          setEditingCatId(cat.id);
          setEditCatName(cat.name);
        }}
        onSaveCategoryName={handleSaveCategoryName}
        onCancelEditName={() => setEditingCatId(null)}
        addingWordCatId={addingWordCatId}
        newWordsText={newWordsText}
        onNewWordsTextChange={setNewWordsText}
        onToggleAddWords={(catId) => {
          setAddingWordCatId((prev) => (prev === catId ? null : catId));
          setNewWordsText('');
        }}
        onAddWordsToCategory={handleAddWordsToCategory}
        onCancelAddWords={() => setAddingWordCatId(null)}
        openBulkMenuCatId={openBulkMenuCatId}
        onToggleBulkMenu={(catId) =>
          setOpenBulkMenuCatId((prev) => (prev === catId ? null : catId))
        }
        onBulkUpdate={handleBulkUpdateCategoryKeywords}
        onOpenAccess={(cat) => {
          setOpenBulkMenuCatId(null);
          setAccessModalCategory(cat);
        }}
        onOpenColor={(cat) => setColorModalCategory(cat)}
        onSelectKeyword={handleSelectKeyword}
        onConfirmDeleteCategory={confirmDeleteCategory}
        onToggleSort={toggleSort}
      />
    </div>
  );
}
