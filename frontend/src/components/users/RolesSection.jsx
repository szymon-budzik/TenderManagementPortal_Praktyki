import { ArrowUpDown, Lock, Plus, Shield, Trash2 } from 'lucide-react';
import { CONFIGURABLE_PERMISSIONS } from '../../rolesStore';

export default function RolesSection({
  roles,
  newRoleName,
  onNewRoleNameChange,
  newRolePerms,
  onToggleNewRolePerm,
  onCreateRole,
  onToggleRoleSort,
  onToggleExistingRolePerm,
  onConfirmDeleteRole,
}) {
  return (
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
        onSubmit={onCreateRole}
        className="bg-white p-4 rounded-xl border border-blue-200 space-y-4 shadow-xs"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Nazwa nowej roli</label>
            <input
              type="text"
              required
              value={newRoleName}
              onChange={(e) => onNewRoleNameChange(e.target.value)}
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
                    onChange={() => onToggleNewRolePerm(perm.id)}
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
                onClick={() => onToggleRoleSort('name')}
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
            {roles.map((r) => {
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
                            onClick={() => onToggleExistingRolePerm(r.name, perm.id)}
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
                        onClick={() => onConfirmDeleteRole(r.name)}
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
  );
}
