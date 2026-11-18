import { ArrowUpDown, ArrowUp, ArrowDown, Trash2, X } from 'lucide-react';

export default function ConfirmModal({
  open,
  title = 'Potwierdzenie usunięcia',
  message = 'Czy na pewno chcesz usunąć ten element?',
  confirmLabel = 'Usuń',
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border-2 border-blue-600 max-w-md w-full p-6 shadow-xl space-y-5 text-black"
      >
        <div className="flex items-start justify-between gap-3 border-b border-blue-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-100 border border-red-400 rounded-xl">
              <Trash2 size={20} className="text-red-700" />
            </div>
            <h3 className="text-lg font-extrabold text-black">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg border border-blue-200 hover:bg-blue-50 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm font-semibold text-black leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-blue-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-black font-bold rounded-xl text-xs cursor-pointer"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-5 py-2 bg-red-500 hover:bg-red-600 border-2 border-red-800 text-white font-extrabold rounded-xl text-xs cursor-pointer"
          >
            <Trash2 size={14} />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SortableTh({ label, sortKey, sortConfig, onSort, className = '' }) {
  const isActive = sortConfig?.key === sortKey;
  const direction = isActive ? sortConfig.direction : null;

  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`p-3.5 font-bold select-none cursor-pointer hover:bg-blue-700 transition ${className}`}
      title="Kliknij, aby posortować kolumnę"
    >
      <div
        className={`inline-flex items-center gap-1.5 ${
          className.includes('text-right')
            ? 'justify-end w-full'
            : className.includes('text-center')
            ? 'justify-center w-full'
            : ''
        }`}
      >
        <span>{label}</span>
        {!isActive && <ArrowUpDown size={14} className="opacity-60 shrink-0" />}
        {isActive && direction === 'asc' && <ArrowUp size={14} className="shrink-0" />}
        {isActive && direction === 'desc' && <ArrowDown size={14} className="shrink-0" />}
      </div>
    </th>
  );
}

export function toggleSort(prevConfig, key) {
  if (prevConfig?.key === key) {
    return { key, direction: prevConfig.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: 'asc' };
}

export function sortArray(items, sortConfig, customGetters = {}) {
  if (!sortConfig?.key) return items;
  const { key, direction } = sortConfig;
  const dir = direction === 'desc' ? -1 : 1;
  const getter = customGetters[key] || ((item) => item?.[key]);

  return [...items].sort((a, b) => {
    let valA = getter(a);
    let valB = getter(b);

    if (valA == null) valA = '';
    if (valB == null) valB = '';

    if (typeof valA === 'boolean' && typeof valB === 'boolean') {
      return (valA === valB ? 0 : valA ? -1 : 1) * dir;
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
      return (valA - valB) * dir;
    }

    const numA = Number(valA);
    const numB = Number(valB);
    if (valA !== '' && valB !== '' && !Number.isNaN(numA) && !Number.isNaN(numB)) {
      return (numA - numB) * dir;
    }

    return (
      String(valA).localeCompare(String(valB), 'pl', {
        numeric: true,
        sensitivity: 'base',
      }) * dir
    );
  });
}

export function EmailTagsPreview({ rawEmails, onChange }) {
  const list = (rawEmails || '')
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter(Boolean);

  if (list.length === 0) return null;

  const handleRemove = (indexToRemove) => {
    if (!onChange) return;
    const updated = list.filter((_, idx) => idx !== indexToRemove).join(', ');
    onChange(updated);
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {list.map((email, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-200 border border-gray-400 rounded-lg text-xs font-extrabold text-black"
        >
          <span>{email}</span>
          {onChange && (
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="hover:text-red-700 font-bold cursor-pointer"
              title="Usuń adres e-mail"
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}