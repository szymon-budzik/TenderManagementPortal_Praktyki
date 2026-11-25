import { CheckCircle2, XCircle, X, RefreshCw, Check, Copy } from 'lucide-react';

export default function EndpointTestModal({
  testModal,
  testingId,
  copiedMarkdown,
  onRetest,
  onCopyMarkdown,
  onClose,
}) {
  if (!testModal) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-2xl border-2 max-w-2xl w-full p-6 shadow-xl space-y-5 text-black max-h-[85vh] overflow-y-auto ${
          testModal.success ? 'border-green-700' : 'border-red-700'
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-blue-100 pb-4">
          <div className="flex items-start gap-3 min-w-0">
            {testModal.success ? (
              <CheckCircle2 size={26} className="text-green-700 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={26} className="text-red-700 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
                Diagnostyka źródła danych (bez zapisu do bazy)
              </div>
              <h3 className="text-lg font-extrabold text-black truncate mt-0.5">
                {testModal.endpoint.name}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-blue-300 hover:bg-blue-50 cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            className={`p-3 rounded-xl border-2 ${
              testModal.success
                ? 'bg-green-100 border-green-700'
                : 'bg-red-100 border-red-700'
            }`}
          >
            <div className="text-[11px] font-bold uppercase">Wynik</div>
            <div className="text-sm font-extrabold mt-0.5">
              {testModal.success ? 'POŁĄCZONO' : 'BŁĄD'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <div className="text-[11px] font-bold uppercase">Kod HTTP</div>
            <div className="text-sm font-mono font-extrabold mt-0.5">
              {testModal.statusCode > 0 ? testModal.statusCode : 'Brak / Sieć'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <div className="text-[11px] font-bold uppercase">Czas odpowiedzi</div>
            <div className="text-sm font-mono font-extrabold mt-0.5">
              {testModal.responseTimeMs} ms
            </div>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <div className="text-[11px] font-bold uppercase">Tryb / Godzina</div>
            <div className="text-xs font-mono font-extrabold mt-1">
              {testModal.endpoint.httpMethod} • {testModal.testedAt}
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-blue-200 rounded-xl space-y-1">
          <div className="text-[11px] font-extrabold uppercase text-blue-800">
            Testowany adres URL
          </div>
          <div className="text-xs font-mono break-all text-black">
            {testModal.resolvedUrl || testModal.endpoint.url}
          </div>
          {testModal.resolvedUrl && testModal.resolvedUrl !== testModal.endpoint.url && (
            <div className="text-[11px] font-mono break-all text-slate-500">
              Szablon: {testModal.endpoint.url}
            </div>
          )}
          {testModal.endpoint.payload && testModal.endpoint.httpMethod !== 'GET' && (
            <div className="text-xs font-mono whitespace-pre-wrap break-all text-slate-700 pt-1.5 mt-1 border-t border-slate-200">
              <span className="font-bold">
                {testModal.endpoint.httpMethod === 'SCRAPER'
                  ? 'Selektor CSS: '
                  : 'Payload JSON:\n'}
              </span>
              {testModal.endpoint.payload}
            </div>
          )}
        </div>

        <div
          className={`p-3.5 rounded-xl border-2 text-sm font-bold whitespace-pre-line ${
            testModal.success
              ? 'bg-green-50 border-green-600 text-black'
              : 'bg-red-50 border-red-600 text-black'
          }`}
        >
          {testModal.message}
        </div>

        {testModal.details && (
          <div className="space-y-1.5">
            <div className="text-xs font-extrabold uppercase text-black">
              Szczegóły techniczne / Treść odpowiedzi serwera
            </div>
            <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono whitespace-pre-wrap break-all max-h-60 overflow-y-auto border border-slate-700">
              {testModal.details}
            </pre>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-blue-100">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={testingId === testModal.endpoint.id}
              onClick={() => onRetest(testModal.endpoint)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-100 hover:bg-amber-200 border-2 border-amber-500 text-black font-extrabold rounded-xl text-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={testingId === testModal.endpoint.id ? 'animate-spin' : ''}
              />
              {testingId === testModal.endpoint.id ? 'Testowanie...' : 'Ponów test'}
            </button>

            <button
              type="button"
              onClick={onCopyMarkdown}
              title="Kopiuje kod błędu, konfigurację i szczegóły techniczne jako gotowy Markdown do wklejenia na czat"
              className={`inline-flex items-center gap-1.5 px-4 py-2 border-2 font-extrabold rounded-xl text-xs cursor-pointer transition ${
                copiedMarkdown
                  ? 'bg-green-300 border-green-700 text-black'
                  : 'bg-white hover:bg-blue-50 border-blue-600 text-black'
              }`}
            >
              {copiedMarkdown ? <Check size={14} /> : <Copy size={14} />}
              {copiedMarkdown ? 'Skopiowano (Markdown)!' : 'Kopiuj jako Markdown'}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}
