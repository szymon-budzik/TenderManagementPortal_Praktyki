import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2,
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  Users,
  UserPlus,
  UserSearch,
  Search,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  getGroupsHierarchy,
  getAssignableUsers,
  createGroup,
  updateGroup,
  deleteGroup,
  setGroupMembers,
  addGroupMember,
  removeGroupMember,
} from '../services/groupsApi';
import ConfirmModal from './ConfirmModal';
import GroupFormModal from './groups/GroupFormModal';
import GroupMembersModal from './groups/GroupMembersModal';
import UserMembershipModal from './groups/UserMembershipModal';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

export default function GroupsView() {
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [filterText, setFilterText] = useState('');
  const [collapsedRootIds, setCollapsedRootIds] = useState({});

  const [userLookupOpen, setUserLookupOpen] = useState(false);
  const [userLookupQuery, setUserLookupQuery] = useState('');
  const [inspectedUserId, setInspectedUserId] = useState(null);
  const userLookupRef = useRef(null);

  const [groupFormModal, setGroupFormModal] = useState(null); // { mode, parentGroup?, initialGroup? }
  const [membersModal, setMembersModal] = useState(null); // { group, parentGroup? }

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { confirmDialog, openConfirm, closeConfirm } = useConfirmDialog();

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsData, usersData] = await Promise.all([
        getGroupsHierarchy(),
        getAssignableUsers(),
      ]);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Nie udało się załadować grup i użytkowników.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getGroupsHierarchy(), getAssignableUsers()])
      .then(([groupsData, usersData]) => {
        if (cancelled) return;
        setGroups(Array.isArray(groupsData) ? groupsData : []);
        setUsers(Array.isArray(usersData) ? usersData : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Nie udało się załadować grup i użytkowników.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleOutside = (e) => {
      if (userLookupRef.current && !userLookupRef.current.contains(e.target)) {
        setUserLookupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const inspectedUser = useMemo(
    () => users.find((u) => u.userId === inspectedUserId) || null,
    [users, inspectedUserId]
  );

  const userGroupCounts = useMemo(() => {
    const map = {};
    groups.forEach((root) => {
      (root.members || []).forEach((m) => {
        if (!map[m.userId]) map[m.userId] = { roots: 0, subs: 0 };
        map[m.userId].roots += 1;
      });
      (root.subgroups || []).forEach((sub) => {
        (sub.members || []).forEach((m) => {
          if (!map[m.userId]) map[m.userId] = { roots: 0, subs: 0 };
          map[m.userId].subs += 1;
        });
      });
    });
    return map;
  }, [groups]);

  const filteredLookupUsers = useMemo(() => {
    const q = userLookupQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    );
  }, [users, userLookupQuery]);

  const filteredGroups = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((root) => {
        const rootMatch =
          (root.name || '').toLowerCase().includes(q) ||
          (root.description || '').toLowerCase().includes(q) ||
          (root.members || []).some((m) => (m.username || '').toLowerCase().includes(q));

        const matchingSubs = (root.subgroups || []).filter(
          (sub) =>
            (sub.name || '').toLowerCase().includes(q) ||
            (sub.description || '').toLowerCase().includes(q) ||
            (sub.members || []).some((m) => (m.username || '').toLowerCase().includes(q))
        );

        if (rootMatch) return root;
        if (matchingSubs.length > 0) return { ...root, subgroups: matchingSubs };
        return null;
      })
      .filter(Boolean);
  }, [groups, filterText]);

  const totalSubgroups = useMemo(
    () => groups.reduce((acc, g) => acc + (g.subgroups?.length || 0), 0),
    [groups]
  );

  const toggleCollapse = (rootId) => {
    setCollapsedRootIds((prev) => ({ ...prev, [rootId]: !prev[rootId] }));
  };

  const handleSaveGroupForm = async (payload) => {
    if (!groupFormModal) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      if (groupFormModal.mode === 'EDIT' && groupFormModal.initialGroup) {
        await updateGroup(groupFormModal.initialGroup.id, payload);
        setSuccess(`Zaktualizowano „${payload.name}”.`);
      } else {
        await createGroup(payload);
        setSuccess(
          payload.parentId
            ? `Dodano podgrupę „${payload.name}”.`
            : `Utworzono grupę główną „${payload.name}”.`
        );
      }
      setGroupFormModal(null);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Nie udało się zapisać grupy.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteGroup = (group, isSubgroup) => {
    openConfirm({
      title: isSubgroup ? 'Usuń podgrupę' : 'Usuń grupę główną',
      message: isSubgroup
        ? `Czy na pewno chcesz usunąć podgrupę „${group.name}” oraz wszystkie jej przypisania użytkowników?`
        : `Czy na pewno chcesz usunąć grupę główną „${group.name}” wraz ze wszystkimi jej podgrupami (${group.subgroups?.length || 0}) i przypisaniami?`,
      onConfirm: async () => {
        setError('');
        setSuccess('');
        try {
          await deleteGroup(group.id);
          setSuccess(`Usunięto „${group.name}”.`);
          await loadData();
        } catch (err) {
          setError(err?.response?.data?.message || 'Nie udało się usunąć grupy.');
        }
      },
    });
  };

  const handleSaveMembers = async (groupId, userIds) => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await setGroupMembers(groupId, userIds);
      setMembersModal(null);
      setSuccess('Zaktualizowano przypisania użytkowników.');
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Nie udało się zapisać członków grupy.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMemberDirect = async (groupId, userId) => {
    setError('');
    setSaving(true);
    try {
      await addGroupMember(groupId, userId);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Nie udało się przypisać użytkownika.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMemberDirect = async (groupId, userId) => {
    setError('');
    setSaving(true);
    try {
      await removeGroupMember(groupId, userId);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Nie udało się wypisać użytkownika z grupy.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 text-black">
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

      <GroupFormModal
        isOpen={Boolean(groupFormModal)}
        mode={groupFormModal?.mode}
        parentGroup={groupFormModal?.parentGroup}
        initialGroup={groupFormModal?.initialGroup}
        saving={saving}
        onSubmit={handleSaveGroupForm}
        onClose={() => setGroupFormModal(null)}
      />

      <GroupMembersModal
        isOpen={Boolean(membersModal)}
        group={membersModal?.group}
        parentGroup={membersModal?.parentGroup}
        allUsers={users}
        saving={saving}
        onSave={handleSaveMembers}
        onClose={() => setMembersModal(null)}
      />

      <UserMembershipModal
        isOpen={Boolean(inspectedUser)}
        user={inspectedUser}
        groups={groups}
        busy={saving}
        onAddToGroup={handleAddMemberDirect}
        onRemoveFromGroup={handleRemoveMemberDirect}
        onClose={() => setInspectedUserId(null)}
      />

      {/* Nagłówek + kompaktowy wyszukiwacz przynależności użytkownika + Nowa grupa */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <Building2 size={26} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-2xl font-bold text-black">Grupy i Podgrupy</h2>
            <p className="text-xs font-semibold text-black mt-0.5">
              Twórz grupy główne (np. firmy) oraz podgrupy (np. działy) i przypisuj do nich użytkowników. Przynależność do grupy głównej daje dostęp do wszystkich jej podgrup.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Kompaktowa lista wyboru użytkownika -> natychmiast otwiera okienko przynależności */}
          <div className="relative" ref={userLookupRef}>
            <button
              type="button"
              onClick={() => {
                setUserLookupOpen((prev) => !prev);
                setUserLookupQuery('');
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border-2 border-blue-400 hover:bg-blue-50 text-black font-extrabold rounded-xl text-xs cursor-pointer shadow-xs transition"
            >
              <UserSearch size={16} className="text-blue-600" />
              <span>Sprawdź użytkownika</span>
              <ChevronDown size={14} />
            </button>

            {userLookupOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-80 bg-white border-2 border-blue-600 rounded-xl shadow-2xl z-40 overflow-hidden">
                <div className="p-2.5 border-b border-blue-100 bg-blue-50/50">
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-600"
                    />
                    <input
                      type="text"
                      autoFocus
                      value={userLookupQuery}
                      onChange={(e) => setUserLookupQuery(e.target.value)}
                      placeholder="Wybierz lub wpisz login użytkownika..."
                      className="w-full pl-8 pr-3 py-1.5 border border-blue-300 rounded-lg bg-white text-xs text-black font-semibold"
                    />
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-blue-100">
                  {filteredLookupUsers.length === 0 ? (
                    <div className="p-4 text-center text-xs font-medium text-black">
                      Brak pasujących użytkowników.
                    </div>
                  ) : (
                    filteredLookupUsers.map((u) => {
                      const counts = userGroupCounts[u.userId] || { roots: 0, subs: 0 };
                      return (
                        <button
                          key={u.userId}
                          type="button"
                          onClick={() => {
                            setInspectedUserId(u.userId);
                            setUserLookupOpen(false);
                          }}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50 flex items-center justify-between gap-2 cursor-pointer transition"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-black truncate">
                              {u.username}
                            </div>
                            <div className="text-[11px] text-black opacity-70 truncate">
                              {u.email}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {counts.roots > 0 && (
                              <span
                                title="Grupy główne"
                                className="px-1.5 py-0.5 rounded bg-amber-100 border border-amber-500 text-[10px] font-extrabold text-black"
                              >
                                G: {counts.roots}
                              </span>
                            )}
                            {counts.subs > 0 && (
                              <span
                                title="Podgrupy"
                                className="px-1.5 py-0.5 rounded bg-blue-100 border border-blue-400 text-[10px] font-extrabold text-black"
                              >
                                P: {counts.subs}
                              </span>
                            )}
                            {counts.roots === 0 && counts.subs === 0 && (
                              <span className="text-[10px] font-bold text-black opacity-50">
                                brak
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setGroupFormModal({ mode: 'CREATE_ROOT' })}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-xs transition"
          >
            <Plus size={16} /> Nowa grupa główna
          </button>
        </div>
      </div>

      {/* Komunikaty */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-500 rounded-xl text-xs font-bold text-black flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="p-1 rounded hover:bg-red-100 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-green-50 border border-green-700 rounded-xl text-xs font-bold text-black flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-700 shrink-0" />
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess('')}
            className="p-1 rounded hover:bg-green-100 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pasek wyszukiwania i podsumowania grup */}
      <div className="bg-white p-3.5 rounded-xl border border-blue-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filtruj po nazwie grupy, podgrupy lub użytkownika..."
            className="w-full pl-9 pr-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-extrabold">
          <span className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-black">
            Grupy główne: {groups.length}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-slate-100 border border-blue-200 text-black">
            Podgrupy: {totalSubgroups}
          </span>
        </div>
      </div>

      {/* Dominująca sekcja: Drzewo grup głównych i podgrup */}
      {loading ? (
        <div className="p-8 bg-white rounded-xl border border-blue-200 text-center font-bold text-sm text-black">
          Ładowanie grup i podgrup...
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="p-10 bg-white rounded-2xl border-2 border-dashed border-blue-300 text-center space-y-3">
          <div className="font-extrabold text-base text-black">
            {groups.length === 0
              ? 'Brak utworzonych grup'
              : 'Brak grup pasujących do filtra'}
          </div>
          <p className="text-xs font-semibold text-black opacity-75 max-w-md mx-auto">
            {groups.length === 0
              ? 'Utwórz pierwszą grupę główną (np. nazwę firmy), a następnie dodaj w niej podgrupy (działy) i przypisz użytkowników.'
              : 'Zmień frazę wyszukiwania lub wyczyść filtr.'}
          </p>
          {groups.length === 0 && (
            <button
              type="button"
              onClick={() => setGroupFormModal({ mode: 'CREATE_ROOT' })}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs cursor-pointer"
            >
              <Plus size={15} /> Utwórz pierwszą grupę
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {filteredGroups.map((root) => {
            const isCollapsed = Boolean(collapsedRootIds[root.id]);
            const rootMembers = root.members || [];
            const subgroups = root.subgroups || [];

            return (
              <section
                key={root.id}
                className="bg-white rounded-2xl border-2 border-blue-200 shadow-xs overflow-hidden"
              >
                {/* Nagłówek grupy głównej (Firmy) */}
                <div className="px-5 py-4 bg-blue-50/70 border-b border-blue-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(root.id)}
                      className="p-1 mt-0.5 rounded-lg hover:bg-blue-100 text-blue-700 cursor-pointer shrink-0"
                      title={isCollapsed ? 'Rozwiń podgrupy' : 'Zwiń podgrupy'}
                    >
                      {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    </button>
                    <Building2 size={21} className="text-blue-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-extrabold text-black truncate">
                          {root.name}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 border border-blue-300 text-blue-900">
                          Podgrup: {subgroups.length}
                        </span>
                        {rootMembers.length > 0 && (
                          <span
                            title="Użytkownicy przypisani do grupy głównej mają dostęp do wszystkich podgrup"
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 border border-amber-500 text-black"
                          >
                            <ShieldCheck size={12} /> Pełny dostęp: {rootMembers.length}
                          </span>
                        )}
                      </div>
                      {root.description && (
                        <p className="text-xs font-medium text-black opacity-80 mt-0.5">
                          {root.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setGroupFormModal({ mode: 'CREATE_SUB', parentGroup: root })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-xs cursor-pointer"
                    >
                      <Plus size={14} /> Podgrupa
                    </button>
                    <button
                      type="button"
                      onClick={() => setMembersModal({ group: root, parentGroup: null })}
                      title="Przypisz użytkowników do grupy głównej (otrzymają dostęp do wszystkich podgrup)"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-500 hover:bg-amber-50 text-black font-bold rounded-lg text-xs cursor-pointer"
                    >
                      <Users size={14} className="text-amber-700" />
                      Grupa główna ({rootMembers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setGroupFormModal({ mode: 'EDIT', initialGroup: root })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black font-bold rounded-lg text-xs cursor-pointer"
                    >
                      <Pencil size={13} /> Edytuj
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmDeleteGroup(root, false)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-red-400 hover:bg-red-50 text-black font-bold rounded-lg text-xs cursor-pointer"
                    >
                      <Trash2 size={13} /> Usuń
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-5 space-y-4">
                    {/* Pasek członków grupy głównej (jeśli istnieją) */}
                    {rootMembers.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-300 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-black">
                            <ShieldCheck size={14} className="text-amber-700" />
                            Członkowie grupy głównej (dostęp do wszystkich podgrup):
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {rootMembers.map((m) => (
                            <span
                              key={m.userId}
                              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-white border border-amber-500 text-xs font-extrabold text-black"
                            >
                              <button
                                type="button"
                                onClick={() => setInspectedUserId(m.userId)}
                                title="Kliknij, aby zobaczyć wszystkie grupy tego użytkownika"
                                className="hover:underline cursor-pointer"
                              >
                                {m.username}
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleRemoveMemberDirect(root.id, m.userId)}
                                title="Wypisz z grupy głównej"
                                className="p-0.5 rounded hover:bg-red-100 text-red-700 cursor-pointer"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Podgrupy (Działy) */}
                    {subgroups.length === 0 ? (
                      <div className="p-6 rounded-xl border border-dashed border-blue-300 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-black opacity-80">
                          Brak podgrup w „{root.name}”. Dodaj podgrupy (np. działy firmy), aby precyzyjnie przypisywać użytkowników.
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setGroupFormModal({ mode: 'CREATE_SUB', parentGroup: root })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black font-bold rounded-lg text-xs cursor-pointer"
                        >
                          <Plus size={14} /> Dodaj pierwszą podgrupę
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                        {subgroups.map((sub) => {
                          const directMembers = sub.members || [];
                          const directIdSet = new Set(directMembers.map((m) => m.userId));
                          const inheritedMembers = rootMembers.filter(
                            (m) => !directIdSet.has(m.userId)
                          );
                          const totalEffective = directMembers.length + inheritedMembers.length;

                          return (
                            <div
                              key={sub.id}
                              className="p-4 rounded-xl border border-blue-200 bg-slate-50 dark:bg-slate-900/70 flex flex-col justify-between gap-3 hover:border-blue-400 transition"
                            >
                              <div className="space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2 min-w-0">
                                    <GitBranch
                                      size={16}
                                      className="text-blue-600 mt-0.5 shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <h4 className="font-extrabold text-sm text-black truncate">
                                        {sub.name}
                                      </h4>
                                      {sub.description && (
                                        <p className="text-[11px] font-medium text-black opacity-75 line-clamp-2 mt-0.5">
                                          {sub.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <span
                                    title={`Bezpośredni: ${directMembers.length}, z grupy głównej: ${inheritedMembers.length}`}
                                    className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-900 shrink-0"
                                  >
                                    {totalEffective} os.
                                  </span>
                                </div>

                                {/* Członkowie podgrupy */}
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {totalEffective === 0 ? (
                                    <span className="text-xs font-medium text-black opacity-60 italic">
                                      Brak przypisanych użytkowników
                                    </span>
                                  ) : (
                                    <>
                                      {directMembers.map((m) => (
                                        <span
                                          key={`direct-${m.userId}`}
                                          className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-lg bg-white border border-blue-400 text-xs font-bold text-black"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => setInspectedUserId(m.userId)}
                                            title="Kliknij, aby zobaczyć wszystkie grupy tego użytkownika"
                                            className="hover:underline cursor-pointer"
                                          >
                                            {m.username}
                                          </button>
                                          <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() =>
                                              handleRemoveMemberDirect(sub.id, m.userId)
                                            }
                                            title="Wypisz z podgrupy"
                                            className="p-0.5 rounded hover:bg-red-100 text-red-700 cursor-pointer"
                                          >
                                            <X size={11} />
                                          </button>
                                        </span>
                                      ))}

                                      {inheritedMembers.map((m) => (
                                        <button
                                          key={`inherited-${m.userId}`}
                                          type="button"
                                          onClick={() => setInspectedUserId(m.userId)}
                                          title="Dostęp odziedziczony z grupy głównej (kliknij, aby zobaczyć szczegóły użytkownika)"
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-dashed border-amber-500 text-xs font-bold text-black hover:bg-amber-100 cursor-pointer"
                                        >
                                          <ShieldCheck size={11} className="text-amber-700" />
                                          {m.username}
                                        </button>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Akcje podgrupy */}
                              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-blue-100">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMembersModal({ group: sub, parentGroup: root })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-400 text-black font-bold rounded-lg text-xs cursor-pointer"
                                >
                                  <UserPlus size={13} /> Przypisz
                                </button>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setGroupFormModal({
                                        mode: 'EDIT',
                                        parentGroup: root,
                                        initialGroup: sub,
                                      })
                                    }
                                    title="Edytuj podgrupę"
                                    className="p-1.5 bg-white border border-blue-300 hover:bg-blue-50 text-black rounded-lg cursor-pointer"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmDeleteGroup(sub, true)}
                                    title="Usuń podgrupę"
                                    className="p-1.5 bg-white border border-red-300 hover:bg-red-50 text-black rounded-lg cursor-pointer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
