import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import ResourceAccessModal from './ResourceAccessModal';
import { RESOURCE_TYPES, getResourceAccessSummary, removeResourceAccess } from '../rolesStore';
import { Mail, Save, Trash2, Pencil, Plus, ArrowUpDown, Shield } from 'lucide-react';

export default function SmtpView() {
  const [smtpAccounts, setSmtpAccounts] = useState([]);
  const [editingSmtpId, setEditingSmtpId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [accessModalSmtp, setAccessModalSmtp] = useState(null);
  const [, setAccessTick] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: 'id', dir: 'asc' });

  const [smtpForm, setSmtpForm] = useState({
    name: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
  });

  const fetchSmtpAccounts = async () => {
    try {
      const res = await api.get('/automation/smtp-accounts');
      setSmtpAccounts(res.data || []);
    } catch (err) {
      console.error('Błąd pobierania kont SMTP:', err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    api
      .get('/automation/smtp-accounts')
      .then((res) => {
        if (!cancelled) setSmtpAccounts(res.data || []);
      })
      .catch((err) => {
        console.error('Błąd pobierania kont SMTP:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resetSmtpForm = () => {
    setEditingSmtpId(null);
    setSmtpForm({
      name: '',
      smtpHost: '',
      smtpPort: 587,
      smtpUsername: '',
      smtpPassword: '',
    });
  };

  const handleEditSmtp = (acc) => {
    setEditingSmtpId(acc.id);
    setSmtpForm({
      name: acc.name || '',
      smtpHost: acc.smtpHost || acc.host || '',
      smtpPort: acc.smtpPort ?? acc.port ?? 587,
      smtpUsername: acc.smtpUsername || acc.username || '',
      smtpPassword: '',
    });
  };

  const handleSaveSmtpAccount = async (e) => {
    e.preventDefault();
    if (!smtpForm.name.trim() || !smtpForm.smtpHost.trim()) return;

    const payload = {
      name: smtpForm.name.trim(),
      smtpHost: smtpForm.smtpHost.trim(),
      host: smtpForm.smtpHost.trim(),
      smtpPort: Number(smtpForm.smtpPort) || 587,
      port: Number(smtpForm.smtpPort) || 587,
      smtpUsername: smtpForm.smtpUsername.trim(),
      username: smtpForm.smtpUsername.trim(),
    };
    if (!editingSmtpId || smtpForm.smtpPassword.trim() !== '') {
      payload.smtpPassword = smtpForm.smtpPassword;
      payload.password = smtpForm.smtpPassword;
    }

    try {
      if (editingSmtpId) {
        await api.put(`/automation/smtp-accounts/${editingSmtpId}`, payload);
      } else {
        await api.post('/automation/smtp-accounts', payload);
      }
      resetSmtpForm();
      fetchSmtpAccounts();
    } catch (err) {
      console.error('Błąd zapisu konta SMTP:', err);
    }
  };

  const confirmDeleteSmtp = (acc) => {
    setConfirmDialog({
      title: 'Usuń konto SMTP',
      message: `Czy na pewno chcesz usunąć konfigurację serwera SMTP "${acc.name}"?`,
      onConfirm: async () => {
        try {
          await api.delete(`/automation/smtp-accounts/${acc.id}`);
          removeResourceAccess(RESOURCE_TYPES.SMTP, acc.id);
          if (editingSmtpId === acc.id) resetSmtpForm();
          fetchSmtpAccounts();
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const toggleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedAccounts = useMemo(() => {
    const copy = [...smtpAccounts];
    copy.sort((a, b) => {
      const { key, dir } = sortConfig;
      const mult = dir === 'asc' ? 1 : -1;
      const valA = a[key] ?? '';
      const valB = b[key] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * mult;
      }
      return String(valA).localeCompare(String(valB), 'pl') * mult;
    });
    return copy;
  }, [smtpAccounts, sortConfig]);

  return (
    <div className="space-y-6 text-black">
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

      <ResourceAccessModal
        isOpen={Boolean(accessModalSmtp)}
        resourceType={RESOURCE_TYPES.SMTP}
        resourceTypeLabel="Konto SMTP"
        resourceId={accessModalSmtp?.id}
        resourceName={accessModalSmtp?.name}
        usageHint="Wybierz, które role mogą korzystać z tego konta SMTP w profilach Automatyzacji oraz podczas ręcznej wysyłki raportów Excel."
        onClose={() => setAccessModalSmtp(null)}
        onSaved={() => setAccessTick((t) => t + 1)}
      />

      <div className="flex items-center gap-2.5">
        <Mail size={24} className="text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-black">
            Konfiguracja Serwerów Pocztowych (SMTP)
          </h2>
          <p className="text-xs font-semibold text-black">
            Dodawaj i edytuj konta SMTP, które można przypisywać do profili automatyzacji Crona oraz ręcznej wysyłki raportów Excel.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSaveSmtpAccount}
        className="bg-white p-5 rounded-xl border border-blue-200 grid grid-cols-1 md:grid-cols-6 gap-3 items-end shadow-xs"
      >
        <div>
          <label className="block text-xs font-bold uppercase mb-1">Nazwa konta</label>
          <input
            type="text"
            required
            value={smtpForm.name}
            onChange={(e) => setSmtpForm({ ...smtpForm, name: e.target.value })}
            placeholder="np. Gmail IT"
            className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase mb-1">Host SMTP</label>
          <input
            type="text"
            required
            value={smtpForm.smtpHost}
            onChange={(e) => setSmtpForm({ ...smtpForm, smtpHost: e.target.value })}
            placeholder="smtp.gmail.com"
            className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase mb-1">Port SMTP</label>
          <input
            type="number"
            required
            value={smtpForm.smtpPort}
            onChange={(e) => setSmtpForm({ ...smtpForm, smtpPort: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase mb-1">Login / E-mail nadawcy</label>
          <input
            type="text"
            required
            value={smtpForm.smtpUsername}
            onChange={(e) => setSmtpForm({ ...smtpForm, smtpUsername: e.target.value })}
            placeholder="twoj@gmail.com"
            className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase mb-1">Hasło aplikacji</label>
          <input
            type="password"
            required={!editingSmtpId}
            value={smtpForm.smtpPassword}
            onChange={(e) => setSmtpForm({ ...smtpForm, smtpPassword: e.target.value })}
            placeholder={editingSmtpId ? 'Pozostaw puste, aby nie zmieniać' : '16-znakowy kod'}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-xs cursor-pointer"
          >
            {editingSmtpId ? <Save size={15} /> : <Plus size={15} />}
            {editingSmtpId ? 'Zapisz' : 'Dodaj SMTP'}
          </button>
          {editingSmtpId && (
            <button
              type="button"
              onClick={resetSmtpForm}
              className="px-3 py-2 bg-white border border-blue-300 hover:bg-blue-50 rounded-lg text-xs font-bold cursor-pointer"
            >
              Anuluj
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-blue-600 text-white select-none">
              <th
                onClick={() => toggleSort('id')}
                className="p-3.5 font-bold w-20 cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  ID <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('name')}
                className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  Nazwa konta <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('smtpHost')}
                className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  Host SMTP <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('smtpPort')}
                className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  Port <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('smtpUsername')}
                className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  Login / E-mail nadawcy <ArrowUpDown size={14} />
                </div>
              </th>
              <th className="p-3.5 font-bold text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100">
            {sortedAccounts.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-6 text-center font-medium text-black">
                  Brak skonfigurowanych kont SMTP. Dodaj pierwsze konto w formularzu powyżej.
                </td>
              </tr>
            ) : (
              sortedAccounts.map((acc) => {
                const accessSummary = getResourceAccessSummary(RESOURCE_TYPES.SMTP, acc.id);
                return (
                <tr key={acc.id} className="hover:bg-blue-50/40">
                  <td className="p-3.5 font-mono font-bold">#{acc.id}</td>
                  <td className="p-3.5 font-extrabold text-black">{acc.name}</td>
                  <td className="p-3.5 font-mono text-xs">{acc.smtpHost || acc.host}</td>
                  <td className="p-3.5 font-mono text-xs">{acc.smtpPort ?? acc.port ?? 587}</td>
                  <td className="p-3.5 font-mono text-xs">{acc.smtpUsername || acc.username}</td>
                  <td className="p-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAccessModalSmtp(acc)}
                        title="Ustaw, które role mają dostęp do tego konta SMTP"
                        className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg font-bold text-xs cursor-pointer transition ${
                          accessSummary.isRestricted
                            ? 'bg-amber-100 hover:bg-amber-200 border-amber-600 text-black'
                            : 'bg-white border-blue-400 hover:bg-blue-50 text-black'
                        }`}
                      >
                        <Shield size={14} />
                        {accessSummary.isRestricted
                          ? `Dostęp (${accessSummary.allowedCount}/${accessSummary.totalRoles})`
                          : 'Dostęp'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditSmtp(acc)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                      >
                        <Pencil size={14} /> Edytuj
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmDeleteSmtp(acc)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-400 hover:bg-red-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                      >
                        <Trash2 size={14} /> Usuń
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}