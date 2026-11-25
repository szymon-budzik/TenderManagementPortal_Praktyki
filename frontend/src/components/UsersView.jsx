import { useState, useEffect, useCallback } from 'react';
import ConfirmModal from './ConfirmModal';
import UserCreateForm from './users/UserCreateForm';
import UsersTable from './users/UsersTable';
import RolesSection from './users/RolesSection';
import {
  getRoles,
  saveRoles,
  getEffectiveUserRole,
  setUserCustomRole,
  mapToBackendRole,
} from '../rolesStore';
import { createUser, deleteUser, getUsers, updateUser } from '../services/usersApi';
import { useSort } from '../hooks/useSort';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

const getUserSortValue = (u, key) =>
  key === 'role' ? getEffectiveUserRole(u.username, u.role) : (u[key] ?? '');

export default function UsersView() {
  const currentUsername = (localStorage.getItem('username') || '').toLowerCase();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(() => getRoles());
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

  const { confirmDialog, openConfirm, closeConfirm } = useConfirmDialog();
  const { toggleSort: toggleUserSort, sortedItems: sortedUsers } = useSort(
    users,
    { key: 'id', dir: 'asc' },
    getUserSortValue
  );
  const { toggleSort: toggleRoleSort, sortedItems: sortedRoles } = useSort(roles, {
    key: 'name',
    dir: 'asc',
  });

  const fetchUsers = useCallback(async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Błąd pobierania użytkowników:', err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const isProtectedAdminUser = (u) => {
    if (!u?.username) return false;
    const uname = u.username.toLowerCase();
    return uname === 'admin' || uname === currentUsername;
  };

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
    openConfirm({
      title: 'Usuń rolę',
      message: `Czy na pewno chcesz usunąć rolę "${roleName}"?`,
      onConfirm: () => {
        const updated = roles.filter((r) => r.name !== roleName);
        setRoles(updated);
        saveRoles(updated);
      },
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const backendRole = mapToBackendRole(newUser.role);
      await createUser({
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
      await updateUser(user.id, { isActive: !user.isActive });
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
      await updateUser(id, {
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
    openConfirm({
      title: 'Usuń użytkownika',
      message: `Czy na pewno chcesz usunąć konto użytkownika "${u.username}"?`,
      onConfirm: async () => {
        await deleteUser(u.id);
        fetchUsers();
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
          onCancel={closeConfirm}
          onClose={closeConfirm}
        />
      )}

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-black">Zarządzanie Użytkownikami</h2>

        <UserCreateForm
          newUser={newUser}
          onChange={setNewUser}
          roles={roles}
          onSubmit={handleCreateUser}
        />

        <UsersTable
          users={sortedUsers}
          roles={roles}
          editingUserId={editingUserId}
          editUserForm={editUserForm}
          setEditUserForm={setEditUserForm}
          isProtectedAdminUser={isProtectedAdminUser}
          onToggleSort={toggleUserSort}
          onToggleActive={handleToggleUserActive}
          onStartEdit={startEditUser}
          onSaveEdit={saveEditUser}
          onCancelEdit={() => setEditingUserId(null)}
          onConfirmDelete={confirmDeleteUser}
        />
      </div>

      <RolesSection
        roles={sortedRoles}
        newRoleName={newRoleName}
        onNewRoleNameChange={setNewRoleName}
        newRolePerms={newRolePerms}
        onToggleNewRolePerm={toggleNewRolePerm}
        onCreateRole={handleCreateRole}
        onToggleRoleSort={toggleRoleSort}
        onToggleExistingRolePerm={handleToggleExistingRolePerm}
        onConfirmDeleteRole={confirmDeleteRole}
      />
    </div>
  );
}
