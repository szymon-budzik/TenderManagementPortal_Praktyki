import { useState, useRef } from 'react';
import api from '../api';
import {
  Database,
  Download,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  FileJson,
} from 'lucide-react';

export default function ConfigBackupModal({ onClose, onImported }) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState('MERGE'); // 'MERGE' | 'REPLACE'
  const [parsedBackup, setParsedBackup] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [feedback, setFeedback] = useState(null);
  const fileInputRef = useRef(null);

  const handleExport = async () => {
    setExporting(true);
    setFeedback(null);
    try {
      const res = await api.get('/admin/backup/export');
      const data = res.data;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
        now.getDate()
      )}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const filename = `przetargi_backup_${stamp}.json`;

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setFeedback({
        success: true,
        text: `Wyeksportowano plik ${filename} (Endpointy: ${
          data.endpoints?.length || 0
        }, Kategorie: ${data.keywordCategories?.length || 0}, Profile: ${
          data.automationProfiles?.length || 0
        }).`,
      });
    } catch (err) {
      setFeedback({
        success: false,
        text: err.response?.data?.message || err.message || 'Błąd podczas eksportu konfiguracji.',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setFeedback(null);
    if (!file) {
      setParsedBackup(null);
      setSelectedFileName('');
      return;
    }

    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result || ''));
        if (
          !json ||
          typeof json !== 'object' ||
          (!Array.isArray(json.endpoints) &&
            !Array.isArray(json.keywordCategories) &&
            !Array.isArray(json.automationProfiles))
        ) {
          setParsedBackup(null);
          setFeedback({
            success: false,
            text: 'Wybrany plik nie jest poprawną kopią zapasową konfiguracji systemu.',
          });
          return;
        }
        setParsedBackup(json);
      } catch (err) {
        setParsedBackup(null);
        setFeedback({
          success: false,
          text: `Błąd parsowania pliku JSON: ${err.message}`,
        });
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleImport = async () => {
    if (!parsedBackup) return;
    setImporting(true);
    setFeedback(null);
    try {
      const res = await api.post('/admin/backup/import', {
        mode: importMode,
        backup: parsedBackup,
      });
      setFeedback({
        success: true,
        text: res.data?.message || 'Konfiguracja została pomyślnie zaimportowana.',
      });
      setParsedBackup(null);
      setSelectedFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (onImported) onImported();
    } catch (err) {
      setFeedback({
        success: false,
        text: err.response?.data?.message || err.message || 'Nie udało się zaimportować pliku.',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border-2 border-blue-600 max-w-2xl w-full shadow-2xl overflow-hidden text-black"
      >
        {/* Nagłówek */}
        <div className="px-6 py-4 bg-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Database size={20} />
            <div>
              <h3 className="text-base font-extrabold">
                Backup i Przywracanie Konfiguracji (JSON)
              </h3>
              <p className="text-xs text-blue-100 font-semibold">
                Endpointy, Kategorie słów kluczowych i Profile automatyzacji
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Sekcja 1: Eksport */}
          <div className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50/60 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 flex-1 min-w-[220px]">
              <div className="text-sm font-extrabold text-black">
                1. Eksportuj aktualną konfigurację
              </div>
              <p className="text-xs font-medium text-slate-700 leading-relaxed">
                Zapisuje wszystkie źródła (wraz z szablonami linków i notatkami), kategorie słów kluczowych oraz profile CRON do jednego pliku <code>.json</code>. Hasła SMTP nie są eksportowane.
              </p>
            </div>
            <button
              type="button"
              disabled={exporting}
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs cursor-pointer shrink-0"
            >
              <Download size={16} />
              {exporting ? 'Generowanie...' : 'Pobierz Backup (.json)'}
            </button>
          </div>

          {/* Sekcja 2: Import */}
          <div className="p-4 rounded-xl border-2 border-emerald-300 bg-emerald-50/40 space-y-4">
            <div className="space-y-1">
              <div className="text-sm font-extrabold text-black">
                2. Przywróć konfigurację z pliku JSON
              </div>
              <p className="text-xs font-medium text-slate-700">
                Wybierz wcześniej wyeksportowany plik. Przy imporcie na czystą bazę powiązania profili automatyzacji zostaną automatycznie przemapowane.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="block w-full text-xs font-semibold text-black file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-emerald-600 file:text-xs file:font-extrabold file:bg-white file:text-black hover:file:bg-emerald-100 file:cursor-pointer cursor-pointer"
              />
            </div>

            {/* Podgląd wczytanego pliku */}
            {parsedBackup && (
              <div className="p-3.5 bg-white rounded-xl border border-emerald-400 space-y-3">
                <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-900">
                  <FileJson size={16} />
                  <span className="truncate">{selectedFileName}</span>
                  {parsedBackup.exportedAt && (
                    <span className="text-[11px] font-semibold text-slate-500 ml-auto shrink-0">
                      Data: {new Date(parsedBackup.exportedAt).toLocaleString('pl-PL')}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="text-[11px] font-bold text-slate-600">Endpointy</div>
                    <div className="text-base font-extrabold">
                      {parsedBackup.endpoints?.length || 0}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="text-[11px] font-bold text-slate-600">Kategorie</div>
                    <div className="text-base font-extrabold">
                      {parsedBackup.keywordCategories?.length || 0}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="text-[11px] font-bold text-slate-600">Profile CRON</div>
                    <div className="text-base font-extrabold">
                      {parsedBackup.automationProfiles?.length || 0}
                    </div>
                  </div>
                </div>

                {/* Wybór trybu importu */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <label
                    className={`p-2.5 rounded-lg border-2 cursor-pointer text-xs ${
                      importMode === 'MERGE'
                        ? 'bg-blue-50 border-blue-600'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-extrabold">
                      <input
                        type="radio"
                        name="importMode"
                        value="MERGE"
                        checked={importMode === 'MERGE'}
                        onChange={() => setImportMode('MERGE')}
                        className="accent-blue-600"
                      />
                      Połącz / Uzupełnij (bezpieczny)
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1 pl-5">
                      Dodaje brakujące pozycje i aktualizuje pasujące po nazwie.
                    </div>
                  </label>

                  <label
                    className={`p-2.5 rounded-lg border-2 cursor-pointer text-xs ${
                      importMode === 'REPLACE'
                        ? 'bg-red-50 border-red-600'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-extrabold text-red-900">
                      <input
                        type="radio"
                        name="importMode"
                        value="REPLACE"
                        checked={importMode === 'REPLACE'}
                        onChange={() => setImportMode('REPLACE')}
                        className="accent-red-600"
                      />
                      Zastąp całą konfigurację
                    </div>
                    <div className="text-[11px] text-red-800 mt-1 pl-5">
                      Usuwa obecne endpointy, kategorie i profile, a następnie odtwarza kopię.
                    </div>
                  </label>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={importing}
                    onClick={handleImport}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 font-extrabold rounded-xl text-xs cursor-pointer border-2 disabled:opacity-50 ${
                      importMode === 'REPLACE'
                        ? 'bg-red-500 hover:bg-red-600 border-red-900 text-white'
                        : 'bg-green-400 hover:bg-green-500 border-green-800 text-black'
                    }`}
                  >
                    <Upload size={15} />
                    {importing
                      ? 'Importowanie...'
                      : importMode === 'REPLACE'
                      ? 'Wyczyść i przywróć konfigurację'
                      : 'Importuj i połącz konfigurację'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Komunikat wyniku */}
          {feedback && (
            <div
              className={`p-3.5 rounded-xl border-2 flex items-start gap-2.5 text-xs font-extrabold ${
                feedback.success
                  ? 'bg-green-50 border-green-700 text-green-950'
                  : 'bg-red-50 border-red-700 text-red-950'
              }`}
            >
              {feedback.success ? (
                <CheckCircle2 size={18} className="text-green-700 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={18} className="text-red-700 shrink-0 mt-0.5" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}
        </div>

        {/* Stopka */}
        <div className="px-6 py-3 bg-slate-50 border-t border-blue-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white border border-blue-400 hover:bg-blue-50 text-black font-bold rounded-xl text-xs cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}