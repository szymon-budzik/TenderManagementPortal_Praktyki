import { ArrowUpDown, Check, Lock, Pencil, Trash2, X } from 'lucide-react';
import { getEffectiveUserRole } from '../../rolesStore';

export default function UsersTable({
  users,
  roles,
  editingUserId,
  editUserForm,
  setEditUserForm,
  isProtectedAdminUser,
  onToggleSort,
  onToggleActive,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onConfirmDelete,
}) {
  return (
    <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-blue-600 text-white select-none">
            <th
              onClick={() => onToggleSort('id')}
              className="p-3.5 font-bold w-16 cursor-pointer hover:bg-blue-700"
            >
              <div className="inline-flex items-center gap-1">
                ID <ArrowUpDown size={14} />
              </div>
            </th>
            <th
              onClick={() => onToggleSort('username')}
              className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
            >
              <div className="inline-flex items-center gap-1">
                Login <ArrowUpDown size={14} />
              </div>
            </th>
            <th
              onClick={() => onToggleSort('email')}
              className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
            >
              <div className="inline-flex items-center gap-1">
                Email <ArrowUpDown size={14} />
              </div>
            </th>
            <th
              onClick={() => onToggleSort('role')}
              className="p-3.5 font-bold w-44 cursor-pointer hover:bg-blue-700"
            >
              <div className="inline-flex items-center gap-1">
                Rola <ArrowUpDown size={14} />
              </div>
            </th>
            <th
              onClick={() => onToggleSort('isActive')}
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
          {users.map((u) => {
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
                      onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
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
                      onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
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
                    onClick={() => onToggleActive(u)}
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
                          onClick={() => onSaveEdit(u.id, u)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs cursor-pointer"
                        >
                          <Check size={14} /> Zapisz
                        </button>
                        <button
                          onClick={onCancelEdit}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-blue-300 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                        >
                          <X size={14} /> Anuluj
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onStartEdit(u)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                        >
                          <Pencil size={14} /> Edytuj
                        </button>
                        {!protectedAdmin && (
                          <button
                            onClick={() => onConfirmDelete(u)}
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
  );
}
