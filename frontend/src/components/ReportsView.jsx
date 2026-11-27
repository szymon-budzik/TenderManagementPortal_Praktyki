import { useState, useEffect, useCallback } from 'react';
import { FileSpreadsheet, CheckCircle2, X, Bell, BellOff } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import ShareModal from './ShareModal';
import ReportsDispatchBar from './reports/ReportsDispatchBar';
import ReportsRunsTable from './reports/ReportsRunsTable';
import { downloadBase64Excel } from './reports/reportUtils';
import {
  deleteRun,
  exportRunsExcel,
  getNotificationPreferences,
  getRuns,
  getSmtpAccounts,
  markAllRunsRead,
  sendRunsEmail,
  updateNotificationPreferences,
} from '../services/automationApi';
import { RESOURCE_TYPES } from '../rolesStore';
import { useAccessibleResources } from '../hooks/useAccessibleResources';
import { useSort } from '../hooks/useSort';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { usePolling } from '../hooks/usePolling';

const getRunSortValue = (r, key) =>
  key === 'userSeqNo' ? (r.userSeqNo ?? r.id ?? 0) : (r[key] ?? '');

export default function ReportsView() {
  const [runs, setRuns] = useState([]);
  const [allSmtpAccounts, setAllSmtpAccounts] = useState([]);
  const [selectedRunIds, setSelectedRunIds] = useState([]);
  const [manualEmails, setManualEmails] = useState('');
  const [manualSmtpId, setManualSmtpId] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [savingNotifPref, setSavingNotifPref] = useState(false);

  const { confirmDialog, openConfirm, closeConfirm } = useConfirmDialog();
  const { toggleSort, sortedItems: sortedRuns } = useSort(
    runs,
    { key: 'userSeqNo', dir: 'desc' },
    getRunSortValue
  );

  const smtpAccounts = useAccessibleResources(RESOURCE_TYPES.SMTP, allSmtpAccounts);

  const effectiveManualSmtpId =
    manualSmtpId && smtpAccounts.some((acc) => String(acc.id) === String(manualSmtpId))
      ? manualSmtpId
      : '';

  const fetchReportsData = useCallback(async () => {
    try {
      const [runsData, smtpData] = await Promise.all([
        getRuns().catch(() => []),
        getSmtpAccounts().catch(() => []),
      ]);
      setRuns(runsData);
      setAllSmtpAccounts(smtpData);
      if (runsData.some((r) => r.isRead === false)) {
        markAllRunsRead()
          .then(() => window.dispatchEvent(new Event('reportsUpdated')))
          .catch(() => {});
      } else {
        window.dispatchEvent(new Event('reportsUpdated'));
      }
    } catch (err) {
      console.error('Błąd pobierania raportów:', err);
    }
  }, []);

  const refreshRunsQuietly = useCallback(async () => {
    try {
      const data = await getRuns();
      setRuns(data);
      if (data.some((r) => r.isRead === false)) {
        markAllRunsRead()
          .then(() => window.dispatchEvent(new Event('reportsUpdated')))
          .catch(() => {});
      }
    } catch {
      // Ciche odświeżanie w tle co 10s
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getRuns().catch(() => []),
      getSmtpAccounts().catch(() => []),
      getNotificationPreferences().catch(() => null),
    ])
      .then(([runsData, smtpData, prefs]) => {
        if (cancelled) return;
        setRuns(runsData);
        setAllSmtpAccounts(smtpData);
        if (prefs && typeof prefs.sharedReportsEnabled === 'boolean') {
          setNotificationsEnabled(prefs.sharedReportsEnabled);
        }
        if (runsData.some((r) => r.isRead === false)) {
          markAllRunsRead()
            .then(() => window.dispatchEvent(new Event('reportsUpdated')))
            .catch(() => {});
        }
      })
      .catch((err) => {
        console.error('Błąd pobierania raportów:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleNotifications = async (checked) => {
    setNotificationsEnabled(checked);
    setSavingNotifPref(true);
    try {
      const updated = await updateNotificationPreferences({ sharedReportsEnabled: checked });
      if (updated && typeof updated.sharedReportsEnabled === 'boolean') {
        setNotificationsEnabled(updated.sharedReportsEnabled);
      }
    } catch (err) {
      setNotificationsEnabled(!checked);
      console.error('Błąd zapisu ustawień powiadomień raportów:', err);
    } finally {
      setSavingNotifPref(false);
    }
  };

  usePolling(refreshRunsQuietly, 10000);

  const toggleSelectRun = (id) => {
    setSelectedRunIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDownloadSelectedExcel = async () => {
    if (selectedRunIds.length === 0) return;
    setLoadingAction(true);
    try {
      const data = await exportRunsExcel(selectedRunIds);
      downloadBase64Excel(data.base64, data.filename);
    } catch (err) {
      console.error('Błąd pobierania Excela:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSendSelectedByEmail = async () => {
    if (selectedRunIds.length === 0 || !effectiveManualSmtpId || !manualEmails.trim()) return;
    setLoadingAction(true);
    try {
      await sendRunsEmail({
        runIds: selectedRunIds,
        emails: manualEmails,
        smtpAccountId: Number(effectiveManualSmtpId),
      });
    } catch (err) {
      console.error('Błąd wysyłki e-mail:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const confirmDeleteRun = (run) => {
    openConfirm({
      title: 'Usuń wpis z historii pobrań',
      message: `Czy na pewno chcesz usunąć pobranie #${run.userSeqNo ?? run.id} (${run.sourceType})?`,
      onConfirm: async () => {
        await deleteRun(run.id);
        setSelectedRunIds((prev) => prev.filter((item) => item !== run.id));
        fetchReportsData();
      },
    });
  };

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
          onCancel={closeConfirm}
          onClose={closeConfirm}
        />
      )}

      <ShareModal
        isOpen={shareModalOpen}
        mode="REPORTS"
        itemIds={selectedRunIds}
        onClose={() => setShareModalOpen(false)}
        onShared={(res) => {
          setSelectedRunIds([]);
          setShareFeedback(res?.message || 'Przesłano wybrane raporty w systemie.');
        }}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-black">
            Raporty Excel i Ręczna Wysyłka E-mail
          </h2>
          <p className="text-sm font-medium text-black mt-1">
            Zaznacz jedno lub kilka pobrań z listy poniżej, aby pobrać arkusz Excel (.xlsx) lub wysłać go na wskazane adresy e-mail.
          </p>
        </div>

        <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border-2 border-blue-300 hover:border-blue-500 text-xs font-extrabold text-black cursor-pointer select-none shadow-xs transition shrink-0">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            disabled={savingNotifPref}
            onChange={(e) => handleToggleNotifications(e.target.checked)}
            className="w-4 h-4 accent-blue-600 cursor-pointer"
          />
          {notificationsEnabled ? (
            <Bell size={15} className="text-blue-600 shrink-0" />
          ) : (
            <BellOff size={15} className="text-slate-500 shrink-0" />
          )}
          <span>Powiadomienia o przesłanych raportach</span>
        </label>
      </div>

      <div className="bg-white p-6 rounded-xl border-2 border-blue-600 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={22} className="text-blue-600" />
            <div>
              <h3 className="text-lg font-extrabold text-black">
                Lista wszystkich pobrań (Zaznacz jedno lub kilka)
              </h3>
              <p className="text-xs font-medium text-black">
                Kliknij w nagłówek kolumny, aby posortować tabelę.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedRunIds(runs.map((r) => r.id))}
              className="px-3 py-1.5 text-xs font-bold bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 cursor-pointer"
            >
              Zaznacz wszystkie
            </button>
            <button
              type="button"
              onClick={() => setSelectedRunIds([])}
              className="px-3 py-1.5 text-xs font-bold bg-white border border-blue-300 rounded-lg hover:bg-blue-50 cursor-pointer"
            >
              Odznacz wszystkie
            </button>
          </div>
        </div>

        {shareFeedback && (
          <div className="p-3 bg-green-50 border border-green-700 rounded-xl text-xs font-extrabold text-black flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-green-700 shrink-0" />
              <span>{shareFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setShareFeedback('')}
              className="p-0.5 rounded hover:bg-green-100 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <ReportsDispatchBar
          smtpAccounts={smtpAccounts}
          manualSmtpId={effectiveManualSmtpId}
          onManualSmtpIdChange={setManualSmtpId}
          manualEmails={manualEmails}
          onManualEmailsChange={setManualEmails}
          selectedCount={selectedRunIds.length}
          loadingAction={loadingAction}
          onSendEmail={handleSendSelectedByEmail}
          onDownloadExcel={handleDownloadSelectedExcel}
          onShareInApp={() => setShareModalOpen(true)}
        />

        <ReportsRunsTable
          runs={sortedRuns}
          selectedRunIds={selectedRunIds}
          onToggleSelectRun={toggleSelectRun}
          onToggleSort={toggleSort}
          onConfirmDeleteRun={confirmDeleteRun}
        />
      </div>
    </div>
  );
}
