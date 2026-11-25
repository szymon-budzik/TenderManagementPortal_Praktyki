import { useState, useEffect, useCallback } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import ReportsDispatchBar from './reports/ReportsDispatchBar';
import ReportsRunsTable from './reports/ReportsRunsTable';
import { downloadBase64Excel } from './reports/reportUtils';
import {
  deleteRun,
  exportRunsExcel,
  getRuns,
  getSmtpAccounts,
  sendRunsEmail,
} from '../services/automationApi';
import { useSort } from '../hooks/useSort';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { usePolling } from '../hooks/usePolling';

export default function ReportsView() {
  const [runs, setRuns] = useState([]);
  const [smtpAccounts, setSmtpAccounts] = useState([]);
  const [selectedRunIds, setSelectedRunIds] = useState([]);
  const [manualEmails, setManualEmails] = useState('');
  const [manualSmtpId, setManualSmtpId] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);

  const { confirmDialog, openConfirm, closeConfirm } = useConfirmDialog();
  const { toggleSort, sortedItems: sortedRuns } = useSort(runs, { key: 'id', dir: 'desc' });

  const fetchReportsData = useCallback(async () => {
    try {
      const [runsData, smtpData] = await Promise.all([
        getRuns().catch(() => []),
        getSmtpAccounts().catch(() => []),
      ]);
      setRuns(runsData);
      setSmtpAccounts(smtpData);
    } catch (err) {
      console.error('Błąd pobierania raportów:', err);
    }
  }, []);

  const refreshRunsQuietly = useCallback(async () => {
    try {
      const data = await getRuns();
      setRuns(data);
    } catch {
      // Ciche odświeżanie w tle co 10s
    }
  }, []);

  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData]);

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
    if (selectedRunIds.length === 0 || !manualSmtpId || !manualEmails.trim()) return;
    setLoadingAction(true);
    try {
      await sendRunsEmail({
        runIds: selectedRunIds,
        emails: manualEmails,
        smtpAccountId: Number(manualSmtpId),
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
      message: `Czy na pewno chcesz usunąć pobranie #${run.id} (${run.sourceType})?`,
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

      <div>
        <h2 className="text-2xl font-extrabold text-black">
          Raporty Excel i Ręczna Wysyłka E-mail
        </h2>
        <p className="text-sm font-medium text-black mt-1">
          Zaznacz jedno lub kilka pobrań z listy poniżej, aby pobrać arkusz Excel (.xlsx) lub wysłać go na wskazane adresy e-mail.
        </p>
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

        <ReportsDispatchBar
          smtpAccounts={smtpAccounts}
          manualSmtpId={manualSmtpId}
          onManualSmtpIdChange={setManualSmtpId}
          manualEmails={manualEmails}
          onManualEmailsChange={setManualEmails}
          selectedCount={selectedRunIds.length}
          loadingAction={loadingAction}
          onSendEmail={handleSendSelectedByEmail}
          onDownloadExcel={handleDownloadSelectedExcel}
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
