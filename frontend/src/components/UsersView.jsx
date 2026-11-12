import { useState, useEffect } from 'react';
import api from '../api';
import { Trash2, Plus, Pencil, Check, X, Shield, AlertCircle } from 'lucide-react';
import {
  CONFIGURABLE_PERMISSIONS,
  getRoles,
  saveRoles,
  getEffectiveUserRole,
  setUserCustomRole,
  mapToBackendRole,
} from '../rolesStore';

export default function UsersView() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(() => getRoles());
  const [errorMsg, setErrorMsg] = useState('');

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
      const list = Array.isArray(res.data) ? res.data : (res.data.content || []);
      setUsers(list);
    } catch (err) {
      console.error('Błąd pobierania użytkowników:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // --- ROLE ---
  const toggleNewRolePerm = (permId) => {
    setNewRolePerms((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleCreateRole = (e) => {
    e.preventDefault();
    setErrorMsg('');
    const formattedName = newRoleName.trim().toUpperCase().replace(/\s+/g, '_');
    if (!formattedName) return;

    if (roles.some((r) => r.name === formattedName)) {
      setErrorMsg('Rola o takiej nazwie już istnieje.');
      return;
    }

    const updated = [...roles, { name: formattedName, permissions: newRolePerms, isSystem: false }];
    setRoles(updated);
    saveRoles(updated);
    setNewRoleName('');
    setNewRolePerms([]);
  };

  const handleToggleExistingRolePerm = (roleName, permId) => {
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

  const handleDeleteRole = (roleName) => {
    if (!confirm(`Usunąć rolę ${roleName}?`)) return;
    const updated = roles.filter((r) => r.name !== roleName);
    setRoles(updated);
    saveRoles(updated);
  };

  // --- UŻYTKOWNICY ---
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setErrorMsg('');
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
      setErrorMsg(
        err.response?.data?.message || 'Błąd dodawania użytkownika (sprawdź login, email i min. 6 znaków hasła).'
      );
    }
  };

  const handleToggleUserActive = async (user) => {
    setErrorMsg('');
    try {
      await api.patch(`/admin/users/${user.id}`, { isActive: !user.isActive });
      fetchUsers();
    } catch {
      setErrorMsg('Błąd zmiany statusu konta.');
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

  const saveEditUser = async (id) => {
    setErrorMsg('');
    try {
      const backendRole = mapToBackendRole(editUserForm.role);
      await api.patch(`/admin/users/${id}`, {
        email: editUserForm.email.trim(),
        role: backendRole,
      });
      setUserCustomRole(editUserForm.username, editUserForm.role);
      setEditingUserId(null);
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Błąd zapisu zmian użytkownika.');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('Czy na pewno chcesz usunąć tego użytkownika?')) return;
    await api.delete(`/admin/users/${id}`);
    fetchUsers();
  };

  return (
    <div className="space-y-10 text-black">
      {errorMsg && (
        <div className="flex items-center gap-2 p-4 bg-red-100 border-2 border-red-600 rounded-xl text-black font-bold text-sm">
          <AlertCircle size={18} className="text-red-700 shrink-0" />
          <span>{errorMsg}</span>
        </div>
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
              <tr className="bg-blue-600 text-white">
                <th className="p-3.5 font-bold">ID</th>
                <th className="p-3.5 font-bold">Login</th>
                <th className="p-3.5 font-bold">Email</th>
                <th className="p-3.5 font-bold">Rola</th>
                <th className="p-3.5 font-bold">Status (Kliknij, aby zmienić)</th>
                <th className="p-3.5 font-bold text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {users.map((u) => {
                const isEditing = editingUserId === u.id;
                const effectiveRole = getEffectiveUserRole(u.username, u.role);

                return (
                  <tr key={u.id} className="hover:bg-blue-50/50">
                    <td className="p-3.5 font-bold">{u.id}</td>
                    <td className="p-3.5 font-semibold">{u.username}</td>
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
                      {isEditing ? (
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
                    <td className="p-3.5">
                      <button
                        type="button"
                        onClick={() => handleToggleUserActive(u)}
                        title="Kliknij, aby przełączyć status konta"
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold border-2 shadow-xs transition transform active:scale-95 cursor-pointer ${
                          u.isActive
                            ? 'bg-green-400 hover:bg-green-500 border-green-800 text-black'
                            : 'bg-red-400 hover:bg-red-500 border-red-800 text-black'
                        }`}
                      >
                        {u.isActive ? 'AKTYWNY' : 'ZABLOKOWANY'}
                      </button>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEditUser(u.id)}
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
                            <button
                              onClick={() => handleDeleteUser(u.id)}
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
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEKCJA 2: KREATOR RÓL (tylko moduły konfiguracyjne) */}
      <div className="space-y-4 pt-6 border-t-2 border-blue-200">
        <div className="flex items-center gap-2">
          <Shield size={24} className="text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-black">Role i Uprawnienia Panelu Roli</h2>
            <p className="text-xs font-medium text-black">
              Zakładki Wyszukiwarka, Przetargi oraz Statystyki są dostępne zawsze dla każdej roli.
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
              <tr className="bg-blue-600 text-white">
                <th className="p-3.5 font-bold">Nazwa Roli</th>
                <th className="p-3.5 font-bold">Dostępne sekcje (Kliknij, aby nadać/odebrać)</th>
                <th className="p-3.5 font-bold text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {roles.map((r) => (
                <tr key={r.name} className="hover:bg-blue-50/50">
                  <td className="p-3.5 font-mono font-extrabold text-black">{r.name}</td>
                  <td className="p-3.5">
                    <div className="flex flex-wrap gap-2">
                      {CONFIGURABLE_PERMISSIONS.map((perm) => {
                        const active = r.permissions.includes(perm.id);
                        return (
                          <button
                            key={perm.id}
                            type="button"
                            onClick={() => handleToggleExistingRolePerm(r.name, perm.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-extrabold border-2 transition cursor-pointer ${
                              active
                                ? 'bg-green-400 hover:bg-green-500 border-green-800 text-black'
                                : 'bg-red-300 hover:bg-red-400 border-red-700 text-black opacity-80'
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
                        onClick={() => handleDeleteRole(r.name)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 hover:bg-red-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                      >
                        <Trash2 size={14} /> Usuń rolę
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}