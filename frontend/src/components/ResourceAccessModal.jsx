import { useState } from 'react';
import { Shield, Lock, X, Check, Users, ShieldAlert } from 'lucide-react';
import {
  getRoles,
  getResourceAllowedRoles,
  setResourceAllowedRoles,
} from '../rolesStore';

export default function ResourceAccessModal(props) {
  if (!props.isOpen || props.resourceId === null || props.resourceId === undefined) return null;
  return (
    <ResourceAccessModalInner
      key={`${props.resourceType}:${props.resourceId}`}
      {...props}
    />
  );
}

function ResourceAccessModalInner({
  resourceType,
  resourceTypeLabel,
  resourceId,
  resourceName,
  usageHint,
  onClose,
  onSaved,
}) {
  const [roles] = useState(() => getRoles());
  const [isRestricted, setIsRestricted] = useState(
    () => getResourceAllowedRoles(resourceType, resourceId) !== null
  );
  const [allowedRoles, setAllowedRoles] = useState(() => {
    const saved = getResourceAllowedRoles(resourceType, resourceId);
    return saved !== null ? saved : getRoles().map((r) => r.name);
  });

  const toggleRole = (roleName) => {
    if (roleName === 'ROLE_ADMIN') return;

    if (!isRestricted) {
      // Przejście z trybu "wszystkie role" na tryb ograniczony — odznaczamy klikniętą rolę
      const next = roles.map((r) => r.name).filter((name) => name !== roleName);
      if (!next.includes('ROLE_ADMIN')) next.unshift('ROLE_ADMIN');
      setIsRestricted(true);
      setAllowedRoles(next);
      return;
    }

    setAllowedRoles((prev) => {
      const has = prev.includes(roleName);
      const next = has ? prev.filter((r) => r !== roleName) : [...prev, roleName];
      if (!next.includes('ROLE_ADMIN')) next.unshift('ROLE_ADMIN');
      return next;
    });
  };

  const handleAllowAll = () => {
    setIsRestricted(false);
    setAllowedRoles(roles.map((r) => r.name));
  };

  const handleAdminOnly = () => {
    setIsRestricted(true);
    setAllowedRoles(['ROLE_ADMIN']);
  };

  const handleSave = () => {
    if (!isRestricted) {
      setResourceAllowedRoles(resourceType, resourceId, null);
    } else {
      setResourceAllowedRoles(resourceType, resourceId, allowedRoles);
    }
    if (onSaved) onSaved();
    onClose();
  };

  const nonAdminCount = roles.filter((r) => r.name !== 'ROLE_ADMIN').length;
  const activeCount = isRestricted
    ? roles.filter((r) => r.name === 'ROLE_ADMIN' || allowedRoles.includes(r.name)).length
    : roles.length;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border-2 border-blue-600 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-black flex flex-col max-h-[85vh]"
      >
        {/* Nagłówek */}
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Shield size={20} className="shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-extrabold truncate">
                Dostęp dla ról: {resourceName}
              </h3>
              <p className="text-xs text-blue-100 font-semibold truncate">
                {resourceTypeLabel} #{resourceId}
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

        {/* Treść */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {usageHint && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-black leading-relaxed">
              {usageHint}
            </div>
          )}

          {/* Tryb dostępu / Szybkie akcje */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-blue-100">
            <div className="text-xs font-extrabold uppercase text-black">
              Tryb:{' '}
              {isRestricted ? (
                <span className="text-amber-700">
                  Ograniczony ({activeCount}/{roles.length} ról)
                </span>
              ) : (
                <span className="text-green-700">Wszystkie role (domyślny)</span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={handleAllowAll}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer transition ${
                  !isRestricted
                    ? 'bg-green-300 border-green-800 text-black'
                    : 'bg-white border-blue-300 hover:bg-blue-50 text-black'
                }`}
              >
                <Users size={12} /> Wszystkie role
              </button>
              <button
                type="button"
                onClick={handleAdminOnly}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer transition ${
                  isRestricted && activeCount === 1
                    ? 'bg-amber-300 border-amber-800 text-black'
                    : 'bg-white border-blue-300 hover:bg-amber-50 text-black'
                }`}
              >
                <ShieldAlert size={12} /> Tylko ADMIN
              </button>
            </div>
          </div>

          {/* Lista ról */}
          <div className="space-y-2">
            {roles.map((r) => {
              const isAdmin = r.name === 'ROLE_ADMIN';
              const hasAccess = isAdmin || !isRestricted || allowedRoles.includes(r.name);

              return (
                <div
                  key={r.name}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-blue-200 bg-slate-50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-extrabold text-sm text-black truncate">
                      {r.name}
                    </span>
                    {isAdmin && (
                      <Lock
                        size={13}
                        className="text-blue-700 shrink-0"
                        title="ROLE_ADMIN zawsze posiada pełny dostęp"
                      />
                    )}
                    {!r.isSystem && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 shrink-0">
                        Własna
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isAdmin}
                    onClick={() => toggleRole(r.name)}
                    title={
                      isAdmin
                        ? 'ROLE_ADMIN zawsze posiada dostęp do wszystkich zasobów'
                        : 'Kliknij, aby nadać lub odebrać dostęp tej roli'
                    }
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold border-2 transition shrink-0 ${
                      isAdmin
                        ? 'bg-green-300 border-green-800 text-black opacity-85 cursor-not-allowed'
                        : hasAccess
                        ? 'bg-green-400 hover:bg-green-500 border-green-800 text-black cursor-pointer'
                        : 'bg-red-300 hover:bg-red-400 border-red-700 text-black opacity-85 cursor-pointer'
                    }`}
                  >
                    Dostęp: {hasAccess ? 'TAK' : 'NIE'}
                  </button>
                </div>
              );
            })}
          </div>

          {nonAdminCount === 0 && (
            <p className="text-xs font-medium text-black">
              Brak innych ról w systemie. Możesz dodać własne role w zakładce Użytkownicy.
            </p>
          )}
        </div>

        {/* Stopka */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-blue-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-black font-bold rounded-lg text-xs cursor-pointer"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-xs cursor-pointer"
          >
            <Check size={14} /> Zapisz dostęp
          </button>
        </div>
      </div>
    </div>
  );
}
