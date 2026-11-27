import { useState, useMemo } from 'react';
import { Users, Check, X, Search, ShieldCheck } from 'lucide-react';

export default function GroupMembersModal(props) {
  if (!props.isOpen || !props.group) return null;
  return <GroupMembersModalInner key={props.group.id} {...props} />;
}

function GroupMembersModalInner({
  group,
  parentGroup,
  allUsers,
  saving,
  onSave,
  onClose,
}) {
  const [selectedIds, setSelectedIds] = useState(() =>
    (group.members || []).map((m) => m.userId)
  );
  const [query, setQuery] = useState('');

  const inheritedUserIds = useMemo(() => {
    if (!parentGroup) return new Set();
    return new Set((parentGroup.members || []).map((m) => m.userId));
  }, [parentGroup]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter(
      (u) =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    );
  }, [allUsers, query]);

  const isRootGroup = !group.parentId;

  const toggleUser = (userId) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border-2 border-blue-600 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden text-black"
      >
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Users size={19} className="shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-extrabold truncate">
                Członkowie: {group.name}
              </h3>
              <p className="text-xs text-blue-100 font-semibold truncate">
                {isRootGroup
                  ? 'Grupa główna — przypisanie daje dostęp do wszystkich podgrup'
                  : `Podgrupa w „${parentGroup?.name || ''}”`}
              </p>
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

        <div className="p-4 space-y-3 border-b border-blue-100">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-black leading-relaxed">
            {isRootGroup
              ? 'Użytkownicy przypisani bezpośrednio do grupy głównej automatycznie posiadają dostęp do wszystkich jej podgrup.'
              : 'Zaznacz użytkowników przypisanych bezpośrednio do tej podgrupy. Członkowie grupy głównej mają dostęp automatycznie (oznaczeni odznaką).'}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj użytkownika po loginie lub e-mailu..."
                className="w-full pl-9 pr-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const visibleIds = filteredUsers.map((u) => u.userId);
                setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
              }}
              className="px-2.5 py-2 text-xs font-bold bg-blue-50 border border-blue-300 hover:bg-blue-100 rounded-lg cursor-pointer shrink-0"
            >
              Wszyscy
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-2 text-xs font-bold bg-white border border-blue-300 hover:bg-blue-50 rounded-lg cursor-pointer shrink-0"
            >
              Wyczyść
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-1.5">
          {filteredUsers.length === 0 ? (
            <p className="text-sm text-center py-6 font-medium text-black">
              Brak użytkowników pasujących do wyszukiwania.
            </p>
          ) : (
            filteredUsers.map((u) => {
              const checked = selectedIds.includes(u.userId);
              const inherited = inheritedUserIds.has(u.userId);

              return (
                <label
                  key={u.userId}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border-2 cursor-pointer transition ${
                    checked
                      ? 'bg-blue-50 border-blue-600'
                      : 'bg-white border-blue-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUser(u.userId)}
                      className="w-4 h-4 accent-blue-600 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm text-black truncate">
                        {u.username}
                      </div>
                      <div className="text-xs text-black opacity-75 truncate">{u.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {inherited && (
                      <span
                        title="Ten użytkownik należy już do grupy głównej i ma dostęp do wszystkich podgrup"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 border border-amber-500 text-black"
                      >
                        <ShieldCheck size={11} /> Z grupy głównej
                      </span>
                    )}
                    {!u.active && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 border border-red-500 text-black">
                        Nieaktywny
                      </span>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-blue-100 flex items-center justify-between gap-3">
          <span className="text-xs font-extrabold text-black">
            Wybrano bezpośrednio: {selectedIds.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-black font-bold rounded-lg text-xs cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => onSave(group.id, selectedIds)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-lg text-xs cursor-pointer"
            >
              <Check size={14} /> {saving ? 'Zapisywanie...' : 'Zapisz członków'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
