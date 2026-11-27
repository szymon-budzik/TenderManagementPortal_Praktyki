import { useState } from 'react';
import { Building2, GitBranch, Save, Plus, X } from 'lucide-react';

export default function GroupFormModal(props) {
  if (!props.isOpen) return null;
  const modalKey = `${props.mode}:${props.initialGroup?.id ?? 'new'}:${props.parentGroup?.id ?? 'root'}`;
  return <GroupFormModalInner key={modalKey} {...props} />;
}

function GroupFormModalInner({
  mode, // 'CREATE_ROOT' | 'CREATE_SUB' | 'EDIT'
  parentGroup,
  initialGroup,
  saving,
  onSubmit,
  onClose,
}) {
  const [name, setName] = useState(initialGroup?.name || '');
  const [description, setDescription] = useState(initialGroup?.description || '');

  const isSubgroup = mode === 'CREATE_SUB' || Boolean(initialGroup?.parentId);
  const isEdit = mode === 'EDIT';

  const title = isEdit
    ? isSubgroup
      ? `Edytuj podgrupę: ${initialGroup?.name}`
      : `Edytuj grupę główną: ${initialGroup?.name}`
    : isSubgroup
    ? `Nowa podgrupa w „${parentGroup?.name}”`
    : 'Nowa grupa główna';

  const subtitle = isSubgroup
    ? 'Np. dział firmy (IT, Handlowy, Budownictwo, Zamówienia)'
    : 'Np. nazwa firmy lub organizacji nadrzędnej';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      parentId: mode === 'CREATE_SUB' ? parentGroup?.id ?? null : initialGroup?.parentId ?? null,
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border-2 border-blue-600 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-black"
      >
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {isSubgroup ? <GitBranch size={19} className="shrink-0" /> : <Building2 size={19} className="shrink-0" />}
            <div className="min-w-0">
              <h3 className="text-base font-extrabold truncate">{title}</h3>
              <p className="text-xs text-blue-100 font-semibold truncate">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 cursor-pointer shrink-0"
            aria-label="Zamknij"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase mb-1">
              {isSubgroup ? 'Nazwa podgrupy (działu) *' : 'Nazwa grupy głównej (firmy) *'}
            </label>
            <input
              type="text"
              required
              autoFocus
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isSubgroup ? 'np. Dział IT, Dział Handlowy' : 'np. Firma ABC Sp. z o.o.'}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase mb-1">
              Opis (opcjonalny)
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Krótki opis grupy lub zakresu odpowiedzialności działu..."
              className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-black font-bold rounded-lg text-xs cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-lg text-xs cursor-pointer"
            >
              {isEdit ? <Save size={14} /> : <Plus size={14} />}
              {saving ? 'Zapisywanie...' : isEdit ? 'Zapisz zmiany' : isSubgroup ? 'Dodaj podgrupę' : 'Utwórz grupę'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
