import { Download, Mail } from 'lucide-react';
import { parseEmailTags } from './reportUtils';

export default function ReportsDispatchBar({
  smtpAccounts,
  manualSmtpId,
  onManualSmtpIdChange,
  manualEmails,
  onManualEmailsChange,
  selectedCount,
  loadingAction,
  onSendEmail,
  onDownloadExcel,
}) {
  const manualEmailTags = parseEmailTags(manualEmails);
  const isNoSmtp = !manualSmtpId;

  const removeManualEmailTag = (indexToRemove) => {
    const next = manualEmailTags.filter((_, idx) => idx !== indexToRemove).join(', ');
    onManualEmailsChange(next);
  };

  return (
    <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-300 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-3">
          <label className="block text-xs font-extrabold uppercase mb-1">Konto SMTP</label>
          <select
            value={manualSmtpId}
            onChange={(e) => onManualSmtpIdChange(e.target.value)}
            className="w-full px-3 py-2 border border-blue-400 rounded-lg bg-white text-black text-xs font-bold"
          >
            <option value="">Brak SMTP</option>
            {smtpAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.smtpUsername || acc.username})
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-5">
          <label
            className={`block text-xs font-extrabold uppercase mb-1 ${
              isNoSmtp ? 'text-slate-400' : 'text-black'
            }`}
          >
            Odbiorcy e-mail (rozdzielone przecinkiem) — Zaznaczono: {selectedCount}
          </label>
          <input
            type="text"
            disabled={isNoSmtp}
            value={isNoSmtp ? '' : manualEmails}
            onChange={(e) => onManualEmailsChange(e.target.value)}
            placeholder={
              isNoSmtp
                ? 'Wybierz konto SMTP, aby wpisać odbiorców'
                : 'np. jan.kowalski@firma.pl, dzial.ofert@firma.pl'
            }
            className={`w-full px-3.5 py-2 border rounded-lg text-sm font-mono transition ${
              isNoSmtp
                ? 'bg-slate-200 border-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-white border-blue-400 text-black'
            }`}
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="button"
            disabled={loadingAction || isNoSmtp || selectedCount === 0 || !manualEmails.trim()}
            onClick={onSendEmail}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-extrabold rounded-lg text-xs cursor-pointer"
          >
            <Mail size={15} />
            Wyślij Excel
          </button>
        </div>

        <div className="md:col-span-2">
          <button
            type="button"
            disabled={loadingAction || selectedCount === 0}
            onClick={onDownloadExcel}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-green-400 hover:bg-green-500 disabled:opacity-40 border-2 border-green-800 text-black font-extrabold rounded-lg text-xs cursor-pointer"
          >
            <Download size={15} />
            Pobierz .xlsx
          </button>
        </div>
      </div>

      {!isNoSmtp && manualEmailTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {manualEmailTags.map((email, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-200 border border-slate-400 rounded-md text-xs font-bold text-black"
            >
              <Mail size={12} className="text-slate-700" />
              {email}
              <button
                type="button"
                onClick={() => removeManualEmailTag(idx)}
                className="hover:text-red-700 font-extrabold cursor-pointer"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
