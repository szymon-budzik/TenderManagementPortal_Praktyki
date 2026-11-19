import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import { Trash2, Plus, Pencil, Check, X, Shield, ArrowUpDown, Lock } from 'lucide-react';
import {
  CONFIGURABLE_PERMISSIONS,
  getRoles,
  saveRoles,
  getEffectiveUserRole,
  setUserCustomRole,
  mapToBackendRole,
} from '../rolesStore';

export default function UsersView() {
  const currentUsername = (localStorage.getItem('username') || '').toLowerCase();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(() => getRoles());
  const [userSort, setUserSort] = useState({ key: 'id', dir: 'asc' });
  const [roleSort, setRoleSort] = useState({ key: 'name', dir: 'asc' });
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'ROLE_USER',
  });

  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserForm, setEditUserForm] = useState({});

  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePerms, setNewRolePerms] = useState([]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      const list = Array.isArray(res.data) ? res.data : res.data.content || [];
      setUsers(list);
    } catch (err) {
      console.error('Błąd pobierania użytkowników:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const isProtectedAdminUser = (u) => {
    if (!u?.username) return false;
    const uname = u.username.toLowerCase();
    return uname === 'admin' || uname === currentUsername;
  };

  const toggleSort = (setter, key) => {
    setter((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedUsers = useMemo(() => {
    const copy = [...users];
    copy.sort((a, b) => {
      const { key, dir } = userSort;
      const mult = dir === 'asc' ? 1 : -1;
      const valA = key === 'role' ? getEffectiveUserRole(a.username, a.role) : a[key] ?? '';
      const valB = key === 'role' ? getEffectiveUserRole(b.username, b.role) : b[key] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * mult;
      }
      if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        return (valA === valB ? 0 : valA ? -1 : 1) * mult;
      }
      return String(valA).localeCompare(String(valB), 'pl') * mult;
    });
    return copy;
  }, [users, userSort]);

  const sortedRoles = useMemo(() => {
    const copy = [...roles];
    copy.sort((a, b) => {
      const mult = roleSort.dir === 'asc' ? 1 : -1;
      return String(a.name).localeCompare(String(b.name), 'pl') * mult;
    });
    return copy;
  }, [roles, roleSort]);

  const toggleNewRolePerm = (permId) => {
    setNewRolePerms((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleCreateRole = (e) => {
    e.preventDefault();
    const formattedName = newRoleName.trim().toUpperCase().replace(/\s+/g, '_');
    if (!formattedName || roles.some((r) => r.name === formattedName)) return;

    const updated = [...roles, { name: formattedName, permissions: newRolePerms, isSystem: false }];
    setRoles(updated);
    saveRoles(updated);
    setNewRoleName('');
    setNewRolePerms([]);
  };

  const handleToggleExistingRolePerm = (roleName, permId) => {
    if (roleName === 'ROLE_ADMIN') return;

    const updated = roles.map((r) => {
      if (r.name !== roleName) return r;
      const hasPerm = r.permissions.includes(permId);
      const nextPerms = hasPerm
        ? r.permissions.filter((p) => p !== permId)
        : [...r.permissions, permId];
      return { ...r, permissions: nextPerms };
    });
    setRoles(updated);
    saveRoles(updated);
  };

  const confirmDeleteRole = (roleName) => {
    setConfirmDialog({
      title: 'Usuń rolę',
      message: `Czy na pewno chcesz usunąć rolę "${roleName}"?`,
      onConfirm: () => {
        const updated = roles.filter((r) => r.name !== roleName);
        setRoles(updated);
        saveRoles(updated);
        setConfirmDialog(null);
      },
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const backendRole = mapToBackendRole(newUser.role);
      await api.post('/admin/users', {
        username: newUser.username.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        role: backendRole,
      });
      setUserCustomRole(newUser.username.trim(), newUser.role);
      setNewUser({ username: '', email: '', password: '', role: 'ROLE_USER' });
      fetchUsers();
    } catch (err) {
      console.error('Błąd dodawania użytkownika:', err);
    }
  };

  const handleToggleUserActive = async (user) => {
    if (isProtectedAdminUser(user)) return;
    try {
      await api.patch(`/admin/users/${user.id}`, { isActive: !user.isActive });
      fetchUsers();
    } catch (err) {
      console.error('Błąd zmiany statusu konta:', err);
    }
  };

  const startEditUser = (u) => {
    setEditingUserId(u.id);
    setEditUserForm({
      username: u.username,
      email: u.email,
      role: getEffectiveUserRole(u.username, u.role),
    });
  };

  const saveEditUser = async (id, user) => {
    try {
      const protectedUser = isProtectedAdminUser(user);
      const targetRole = protectedUser ? 'ROLE_ADMIN' : editUserForm.role;
      const backendRole = mapToBackendRole(targetRole);
      await api.patch(`/admin/users/${id}`, {
        email: editUserForm.email.trim(),
        role: backendRole,
      });
      if (!protectedUser) {
        setUserCustomRole(editUserForm.username, targetRole);
      }
      setEditingUserId(null);
      fetchUsers();
    } catch (err) {
      console.error('Błąd zapisu użytkownika:', err);
    }
  };

  const confirmDeleteUser = (u) => {
    if (isProtectedAdminUser(u)) return;
    setConfirmDialog({
      title: 'Usuń użytkownika',
      message: `Czy na pewno chcesz usunąć konto użytkownika "${u.username}"?`,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/users/${u.id}`);
          fetchUsers();
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  return (
    <div className="space-y-10 text-black">
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

      {/* SEKCJA 1: UŻYTKOWNICY */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-black">Zarządzanie Użytkownikami</h2>

        <form
          onSubmit={handleCreateUser}
          className="bg-white p-4 rounded-xl border border-blue-200 grid grid-cols-1 md:grid-cols-5 gap-3 items-end shadow-xs"
        >
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Login</label>
            <input
              type="text"
              required
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black"
              placeholder="np. jkowalski"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Email</label>
            <input
              type="email"
              required
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black"
              placeholder="jan@firma.pl"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Hasło (min. 6 zn.)</label>
            <input
              type="password"
              required
              minLength={6}
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Przypisz Rolę</label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-black font-semibold"
            >
              {roles.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
          >
            <Plus size={16} /> Dodaj użytkownika
          </button>
        </form>

        <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-blue-600 text-white select-none">
                <th
                  onClick={() => toggleSort(setUserSort, 'id')}
                  className="p-3.5 font-bold w-16 cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    ID <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort(setUserSort, 'username')}
                  className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Login <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort(setUserSort, 'email')}
                  className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Email <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort(setUserSort, 'role')}
                  className="p-3.5 font-bold w-44 cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Rola <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort(setUserSort, 'isActive')}
                  className="p-3.5 font-bold w-40 cursor-pointer hover:bg-blue-700 whitespace-nowrap"
                >
                  <div className="inline-flex items-center gap-1">
                    Status <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="p-3.5 font-bold w-48 text-right whitespace-nowrap">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {sortedUsers.map((u) => {
                const isEditing = editingUserId === u.id;
                const effectiveRole = getEffectiveUserRole(u.username, u.role);
                const protectedAdmin = isProtectedAdminUser(u);

                return (
                  <tr key={u.id} className="hover:bg-blue-50/50">
                    <td className="p-3.5 font-bold">{u.id}</td>
                    <td className="p-3.5 font-semibold">
                      <div className="inline-flex items-center gap-1.5">
                        <span>{u.username}</span>
                        {protectedAdmin && (
                          <Lock
                            size={13}
                            className="text-blue-700"
                            title="Chronione konto administratora"
                          />
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      {isEditing ? (
                        <input
                          type="email"
                          value={editUserForm.email}
                          onChange={(e) =>
                            setEditUserForm({ ...editUserForm, email: e.target.value })
                          }
                          className="w-full px-2.5 py-1 border border-blue-400 rounded bg-white text-black"
                        />
                      ) : (
                        u.email
                      )}
                    </td>
                    <td className="p-3.5 font-mono font-bold">
                      {isEditing && !protectedAdmin ? (
                        <select
                          value={editUserForm.role}
                          onChange={(e) =>
                            setEditUserForm({ ...editUserForm, role: e.target.value })
                          }
                          className="px-2.5 py-1 border border-blue-400 rounded bg-white text-black font-sans"
                        >
                          {roles.map((r) => (
                            <option key={r.name} value={r.name}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="px-2.5 py-1 bg-blue-50 border border-blue-300 rounded text-xs">
                          {effectiveRole}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={protectedAdmin}
                        onClick={() => handleToggleUserActive(u)}
                        title={
                          protectedAdmin
                            ? 'Nie można zablokować konta administratora'
                            : 'Kliknij, aby zmienić status konta'
                        }
                        className={`w-32 py-1.5 text-center rounded-lg text-xs font-extrabold border-2 shadow-xs transition ${
                          protectedAdmin
                            ? 'bg-green-300 border-green-800 text-black opacity-85 cursor-not-allowed'
                            : u.isActive
                            ? 'bg-green-400 hover:bg-green-500 border-green-800 text-black cursor-pointer active:scale-95'
                            : 'bg-red-400 hover:bg-red-500 border-red-800 text-black cursor-pointer active:scale-95'
                        }`}
                      >
                        {u.isActive ? 'AKTYWNY' : 'ZABLOKOWANY'}
                      </button>
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEditUser(u.id, u)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <Check size={14} /> Zapisz
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-blue-300 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <X size={14} /> Anuluj
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditUser(u)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <Pencil size={14} /> Edytuj
                            </button>
                            {!protectedAdmin && (
                              <button
                                onClick={() => confirmDeleteUser(u)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 hover:bg-red-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                              >
                                <Trash2 size={14} /> Usuń
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEKCJA 2: KREATOR RÓL */}
      <div className="space-y-4 pt-6 border-t-2 border-blue-200">
        <div className="flex items-center gap-2">
          <Shield size={24} className="text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-black">Role i Uprawnienia Panelu Roli</h2>
            <p className="text-xs font-medium text-black">
              Zakładki Wyszukiwarka, Automatyzacja, Raporty, Przetargi oraz Statystyki są dostępne zawsze dla każdej roli. Rola ROLE_ADMIN zawsze zachowuje pełne uprawnienia.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleCreateRole}
          className="bg-white p-4 rounded-xl border border-blue-200 space-y-4 shadow-xs"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Nazwa nowej roli</label>
              <input
                type="text"
                required
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="np. MANAGER lub ANALITYK"
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black font-semibold"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase mb-2">
                Dostęp do sekcji zarządzania
              </label>
              <div className="flex flex-wrap gap-3">
                {CONFIGURABLE_PERMISSIONS.map((perm) => (
                  <label
                    key={perm.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-300 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={newRolePerms.includes(perm.id)}
                      onChange={() => toggleNewRolePerm(perm.id)}
                      className="accent-blue-600 w-4 h-4"
                    />
                    {perm.label}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
            >
              <Plus size={16} /> Utwórz Rolę
            </button>
          </div>
        </form>

        <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-blue-600 text-white select-none">
                <th
                  onClick={() => toggleSort(setRoleSort, 'name')}
                  className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
                >
                  <div className="inline-flex items-center gap-1">
                    Nazwa Roli <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="p-3.5 font-bold">Dostępne sekcje (Kliknij, aby nadać/odebrać)</th>
                <th className="p-3.5 font-bold text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {sortedRoles.map((r) => {
                const isAdminRole = r.name === 'ROLE_ADMIN';
                return (
                  <tr key={r.name} className="hover:bg-blue-50/50">
                    <td className="p-3.5 font-mono font-extrabold text-black">
                      <div className="inline-flex items-center gap-1.5">
                        <span>{r.name}</span>
                        {isAdminRole && (
                          <Lock
                            size={13}
                            className="text-blue-700"
                            title="ROLE_ADMIN posiada pełne, niezmienne uprawnienia"
                          />
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-2">
                        {CONFIGURABLE_PERMISSIONS.map((perm) => {
                          const active = isAdminRole || r.permissions.includes(perm.id);
                          return (
                            <button
                              key={perm.id}
                              type="button"
                              disabled={isAdminRole}
                              onClick={() => handleToggleExistingRolePerm(r.name, perm.id)}
                              title={
                                isAdminRole
                                  ? 'ROLE_ADMIN ma stały dostęp do wszystkich sekcji'
                                  : 'Kliknij, aby zmienić uprawnienie'
                              }
                              className={`px-3 py-1 rounded-lg text-xs font-extrabold border-2 transition ${
                                isAdminRole
                                  ? 'bg-green-300 border-green-800 text-black opacity-85 cursor-not-allowed'
                                  : active
                                  ? 'bg-green-400 hover:bg-green-500 border-green-800 text-black cursor-pointer'
                                  : 'bg-red-300 hover:bg-red-400 border-red-700 text-black opacity-80 cursor-pointer'
                              }`}
                            >
                              {perm.label}: {active ? 'TAK' : 'NIE'}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-3.5 text-right">
                      {!r.isSystem && (
                        <button
                          onClick={() => confirmDeleteRole(r.name)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 hover:bg-red-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                        >
                          <Trash2 size={14} /> Usuń rolę
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}