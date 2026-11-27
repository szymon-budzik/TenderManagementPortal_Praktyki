import { useState, useMemo } from 'react';
import {
  User,
  Building2,
  GitBranch,
  ShieldCheck,
  X,
  Plus,
  Trash2,
} from 'lucide-react';

export default function UserMembershipModal({
  isOpen,
  user,
  groups,
  busy,
  onAddToGroup,
  onRemoveFromGroup,
  onClose,
}) {
  const [targetGroupId, setTargetGroupId] = useState('');

  const membershipData = useMemo(() => {
    if (!user) {
      return { directRoots: [], directSubgroups: [], effectiveSubgroupCount: 0, directGroupIdSet: new Set() };
    }

    const directRoots = [];
    const directSubgroups = [];
    const effectiveSubgroupIds = new Set();
    const directGroupIdSet = new Set();

    (groups || []).forEach((root) => {
      const inRoot = (root.members || []).some((m) => m.userId === user.userId);
      if (inRoot) {
        directRoots.push(root);
        directGroupIdSet.add(root.id);
        (root.subgroups || []).forEach((sub) => effectiveSubgroupIds.add(sub.id));
      }

      (root.subgroups || []).forEach((sub) => {
        const inSub = (sub.members || []).some((m) => m.userId === user.userId);
        if (inSub) {
          directSubgroups.push({ root, subgroup: sub, alsoInRoot: inRoot });
          directGroupIdSet.add(sub.id);
          effectiveSubgroupIds.add(sub.id);
        }
      });
    });

    return {
      directRoots,
      directSubgroups,
      effectiveSubgroupCount: effectiveSubgroupIds.size,
      directGroupIdSet,
    };
  }, [user, groups]);

  if (!isOpen || !user) return null;

  const { directRoots, directSubgroups, effectiveSubgroupCount, directGroupIdSet } = membershipData;
  const hasAny = directRoots.length > 0 || directSubgroups.length > 0;

  const handleQuickAdd = async () => {
    if (!targetGroupId) return;
    await onAddToGroup(Number(targetGroupId), user.userId);
    setTargetGroupId('');
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border-2 border-blue-600 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-black"
      >
        {/* Nagłówek */}
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-white/15 shrink-0">
              <User size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold truncate">
                Przynależność użytkownika: {user.username}
              </h3>
              <p className="text-xs text-blue-100 font-semibold truncate">
                {user.email} {!user.active ? '• Konto nieaktywne' : ''}
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

        {/* Podsumowanie liczbowe */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 border-b border-blue-100">
          <div className="p-2.5 rounded-xl bg-white border border-blue-200 text-center">
            <div className="text-[11px] font-bold uppercase text-black opacity-75">
              Grupy główne
            </div>
            <div className="text-xl font-extrabold text-black mt-0.5">
              {directRoots.length}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-blue-200 text-center">
            <div className="text-[11px] font-bold uppercase text-black opacity-75">
              Podgrupy (bezpośrednie)
            </div>
            <div className="text-xl font-extrabold text-black mt-0.5">
              {directSubgroups.length}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-blue-200 text-center">
            <div className="text-[11px] font-bold uppercase text-black opacity-75">
              Łączny dostęp do podgrup
            </div>
            <div className="text-xl font-extrabold text-black mt-0.5">
              {effectiveSubgroupCount}
            </div>
          </div>
        </div>

        {/* Szczegółowa lista przynależności */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {!hasAny ? (
            <div className="p-6 rounded-xl border-2 border-dashed border-blue-200 text-center text-sm font-semibold text-black">
              Ten użytkownik nie jest jeszcze przypisany do żadnej grupy ani podgrupy.
            </div>
          ) : (
            <>
              {directRoots.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-blue-700">
                    <Building2 size={15} />
                    Grupy główne (dostęp do wszystkich podgrup)
                  </div>
                  <div className="space-y-2">
                    {directRoots.map((root) => (
                      <div
                        key={root.id}
                        className="p-3.5 rounded-xl border-2 border-amber-400 bg-amber-50/60 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <span className="font-extrabold text-sm text-black">
                              {root.name}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-200 border border-amber-600 text-black">
                              <ShieldCheck size={12} /> Wszystkie podgrupy ({root.subgroups?.length || 0})
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onRemoveFromGroup(root.id, user.userId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-red-400 hover:bg-red-50 text-black rounded-lg text-xs font-bold cursor-pointer shrink-0 disabled:opacity-50"
                          >
                            <Trash2 size={13} /> Wypisz
                          </button>
                        </div>

                        {root.subgroups && root.subgroups.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {root.subgroups.map((sub) => (
                              <span
                                key={sub.id}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-white border border-amber-400 text-black"
                              >
                                <GitBranch size={11} className="text-amber-700" />
                                {sub.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {directSubgroups.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-blue-700">
                    <GitBranch size={15} />
                    Podgrupy (przypisanie bezpośrednie)
                  </div>
                  <div className="space-y-2">
                    {directSubgroups.map(({ root, subgroup, alsoInRoot }) => (
                      <div
                        key={subgroup.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50/50"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold text-black">
                            <span className="opacity-75 font-bold">{root.name}</span>
                            <span className="text-blue-600">→</span>
                            <span>{subgroup.name}</span>
                            {alsoInRoot && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 border border-amber-500 text-black">
                                też w grupie głównej
                              </span>
                            )}
                          </div>
                          {subgroup.description && (
                            <div className="text-xs text-black opacity-75 truncate mt-0.5">
                              {subgroup.description}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onRemoveFromGroup(subgroup.id, user.userId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-red-400 hover:bg-red-50 text-black rounded-lg text-xs font-bold cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          <Trash2 size={13} /> Wypisz
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Szybkie dopisanie użytkownika do kolejnej grupy lub podgrupy */}
          {(groups || []).length > 0 && (
            <div className="pt-4 border-t border-blue-100 space-y-2">
              <label className="block text-xs font-extrabold uppercase text-black">
                Szybko przypisz użytkownika do grupy lub podgrupy
              </label>
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <select
                  value={targetGroupId}
                  onChange={(e) => setTargetGroupId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-blue-300 rounded-lg bg-white text-xs font-bold text-black"
                >
                  <option value="">-- Wybierz grupę główną lub podgrupę --</option>
                  {groups.map((root) => (
                    <optgroup key={root.id} label={root.name}>
                      <option
                        value={root.id}
                        disabled={directGroupIdSet.has(root.id)}
                      >
                        [Grupa główna] {root.name} (wszystkie podgrupy)
                        {directGroupIdSet.has(root.id) ? ' ✓' : ''}
                      </option>
                      {(root.subgroups || []).map((sub) => (
                        <option
                          key={sub.id}
                          value={sub.id}
                          disabled={directGroupIdSet.has(sub.id)}
                        >
                          ↳ {sub.name}
                          {directGroupIdSet.has(sub.id) ? ' ✓' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!targetGroupId || busy}
                  onClick={handleQuickAdd}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-lg text-xs cursor-pointer shrink-0"
                >
                  <Plus size={14} /> Przypisz
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stopka */}
        <div className="px-5 py-3 bg-slate-50 border-t border-blue-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}
