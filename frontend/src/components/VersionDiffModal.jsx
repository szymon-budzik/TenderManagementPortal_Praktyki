import { useState, useMemo } from 'react';
import { X, ArrowLeftRight, Plus, Minus } from 'lucide-react';

function parseStructuredLines(desc) {
  const fields = new Map();
  const freeLines = [];

  if (!desc) return { fields, freeLines };

  const keyCounts = new Map();
  desc.split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    if (line.toLowerCase().startsWith('punktacja kategorii:')) return;

    const colonIdx = line.indexOf(':');
    const looksLikeUrlOnly =
      line.toLowerCase().startsWith('http://') || line.toLowerCase().startsWith('https://');

    if (colonIdx > 0 && colonIdx <= 65 && !looksLikeUrlOnly) {
      const rawKey = line.substring(0, colonIdx).trim();
      const val = line.substring(colonIdx + 1).trim();
      const baseKey = rawKey.toLowerCase();
      const count = (keyCounts.get(baseKey) || 0) + 1;
      keyCounts.set(baseKey, count);
      const uniqueKey = count === 1 ? baseKey : `${baseKey}#${count}`;
      fields.set(uniqueKey, { label: rawKey, value: val });
    } else {
      freeLines.push(line);
    }
  });

  return { fields, freeLines };
}

function formatDateTime(iso) {
  if (!iso) return 'Brak';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function VersionDiffModal({ oldVersion, newVersion, onClose }) {
  const [onlyChanges, setOnlyChanges] = useState(true);

  const diffRows = useMemo(() => {
    const rows = [];

    // 1. Tytuł
    const oldTitle = (oldVersion?.title || '').trim();
    const newTitle = (newVersion?.title || '').trim();
    rows.push({
      label: 'Tytuł postępowania',
      oldVal: oldTitle,
      newVal: newTitle,
      status: oldTitle === newTitle ? 'SAME' : 'CHANGED',
    });

    // 2. ID Zewnętrzne
    const oldExt = (oldVersion?.externalId || '').trim();
    const newExt = (newVersion?.externalId || '').trim();
    rows.push({
      label: 'ID ogłoszenia',
      oldVal: oldExt || '—',
      newVal: newExt || '—',
      status: oldExt === newExt ? 'SAME' : 'CHANGED',
    });

    // 3. Termin składania ofert
    const oldDl = formatDateTime(oldVersion?.submissionDeadline);
    const newDl = formatDateTime(newVersion?.submissionDeadline);
    rows.push({
      label: 'Termin składania ofert',
      oldVal: oldDl,
      newVal: newDl,
      status: oldDl === newDl ? 'SAME' : 'CHANGED',
    });

    // 4. Pola ze szczegółów (klucz: wartość)
    const oldParsed = parseStructuredLines(oldVersion?.description);
    const newParsed = parseStructuredLines(newVersion?.description);

    const orderedKeys = [];
    const seen = new Set();
    for (const k of oldParsed.fields.keys()) {
      orderedKeys.push(k);
      seen.add(k);
    }
    for (const k of newParsed.fields.keys()) {
      if (!seen.has(k)) {
        orderedKeys.push(k);
        seen.add(k);
      }
    }

    for (const key of orderedKeys) {
      const o = oldParsed.fields.get(key);
      const n = newParsed.fields.get(key);
      const label = n?.label || o?.label || key;
      const oldVal = o?.value ?? '';
      const newVal = n?.value ?? '';

      let status = 'SAME';
      if (!o && n) status = 'ADDED';
      else if (o && !n) status = 'REMOVED';
      else if (oldVal !== newVal) status = 'CHANGED';

      rows.push({ label, oldVal, newVal, status });
    }

    // 5. Ewentualne luźne linie bez klucza
    const oldFreeSet = new Set(oldParsed.freeLines);
    const newFreeSet = new Set(newParsed.freeLines);

    oldParsed.freeLines.forEach((line, idx) => {
      if (!newFreeSet.has(line)) {
        rows.push({
          label: `Treść (linia #${idx + 1})`,
          oldVal: line,
          newVal: '',
          status: 'REMOVED',
        });
      }
    });

    newParsed.freeLines.forEach((line, idx) => {
      if (!oldFreeSet.has(line)) {
        rows.push({
          label: `Treść (nowa linia #${idx + 1})`,
          oldVal: '',
          newVal: line,
          status: 'ADDED',
        });
      }
    });

    return rows;
  }, [oldVersion, newVersion]);

  const changedCount = diffRows.filter((r) => r.status !== 'SAME').length;
  const displayedRows = onlyChanges ? diffRows.filter((r) => r.status !== 'SAME') : diffRows;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border-2 border-blue-600 max-w-5xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-black"
      >
        {/* Nagłówek */}
        <div className="px-6 py-4 bg-blue-600 text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <ArrowLeftRight size={20} className="shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-extrabold truncate">
                Porównanie zmian: {oldVersion?.versionLabel} → {newVersion?.versionLabel}
              </h3>
              <p className="text-xs text-blue-100 font-semibold">
                Wykrytych różnic w polach: {changedCount}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 cursor-pointer shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Pasek opcji */}
        <div className="px-6 py-3 bg-slate-50 border-b border-blue-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3 text-xs font-extrabold">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-100 border border-red-400 text-red-950">
              <Minus size={12} /> Poprzednia wartość (usunięto / zmieniono)
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-green-100 border border-green-500 text-green-950">
              <Plus size={12} /> Nowa wartość (dodano / zmieniono)
            </span>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-extrabold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyChanges}
              onChange={(e) => setOnlyChanges(e.target.checked)}
              className="w-4 h-4 accent-blue-600 cursor-pointer"
            />
            Pokaż tylko różnice ({changedCount})
          </label>
        </div>

        {/* Tabela porównania 2-kolumnowego */}
        <div className="overflow-y-auto p-5 space-y-3 flex-1">
          {displayedRows.length === 0 ? (
            <div className="p-8 text-center text-sm font-bold text-slate-600">
              Brak różnic tekstowych między tymi wersjami.
            </div>
          ) : (
            <div className="space-y-2.5">
              {displayedRows.map((row, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border overflow-hidden ${
                    row.status === 'SAME' ? 'border-slate-200' : 'border-blue-400'
                  }`}
                >
                  <div className="px-3.5 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-black">{row.label}</span>
                    {row.status === 'CHANGED' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-200 border border-amber-700">
                        ZMIENIONO
                      </span>
                    )}
                    {row.status === 'ADDED' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-green-200 border border-green-700">
                        DODANO
                      </span>
                    )}
                    {row.status === 'REMOVED' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-200 border border-red-700">
                        USUNIĘTO
                      </span>
                    )}
                    {row.status === 'SAME' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-slate-300 text-slate-500">
                        BEZ ZMIAN
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 text-xs">
                    {/* Lewa kolumna: stara wersja */}
                    <div
                      className={`p-3 whitespace-pre-wrap break-words ${
                        row.status === 'REMOVED' || row.status === 'CHANGED'
                          ? 'bg-red-50/90 text-red-950 font-semibold'
                          : 'bg-white text-slate-700'
                      }`}
                    >
                      <div className="text-[10px] font-extrabold uppercase opacity-60 mb-1">
                        {oldVersion?.versionLabel}
                      </div>
                      {row.oldVal ? (
                        <span className={row.status === 'REMOVED' ? 'line-through' : ''}>
                          {row.oldVal}
                        </span>
                      ) : (
                        <span className="italic opacity-50">— brak pola —</span>
                      )}
                    </div>

                    {/* Prawa kolumna: nowa wersja */}
                    <div
                      className={`p-3 whitespace-pre-wrap break-words ${
                        row.status === 'ADDED' || row.status === 'CHANGED'
                          ? 'bg-green-50/90 text-green-950 font-semibold'
                          : 'bg-white text-slate-700'
                      }`}
                    >
                      <div className="text-[10px] font-extrabold uppercase opacity-60 mb-1">
                        {newVersion?.versionLabel}
                      </div>
                      {row.newVal ? (
                        <span>{row.newVal}</span>
                      ) : (
                        <span className="italic opacity-50">— usunięto pole —</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stopka */}
        <div className="px-6 py-3 bg-slate-50 border-t border-blue-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer"
          >
            Zamknij porównanie
          </button>
        </div>
      </div>
    </div>
  );
}