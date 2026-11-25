import { Clock, ExternalLink, Trash2, X } from 'lucide-react';
import HighlightedText, { MatchedKeywordsSummary } from '../HighlightedText';
import {
  formatDateTimePl,
  getShortHoursBadge,
  getTenderDeadlineIso,
  getTenderLink,
  getTenderScoreDisplay,
  getTenderSource,
} from './tenderUtils';

export default function TenderDetailsModal({
  tender,
  categories,
  nowMs,
  onToggleStatus,
  onConfirmDelete,
  onClose,
}) {
  if (!tender) return null;

  const tenderLink = getTenderLink(tender);
  const tenderDeadline = getTenderDeadlineIso(tender);
  const hoursBadge = getShortHoursBadge(tenderDeadline, nowMs);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border-2 border-blue-600 max-w-2xl w-full p-6 shadow-xl space-y-5 text-black max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4 border-b border-blue-200 pb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-1 bg-blue-50 border border-blue-300 rounded">
                ID: {tender.externalId}
              </span>
              <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 border border-slate-300 rounded">
                Źródło: {getTenderSource(tender)}
              </span>
            </div>
            <h3 className="text-xl font-extrabold text-black mt-2">
              <HighlightedText
                text={tender.title}
                categories={categories}
                descriptionForFilter={tender.description}
              />
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-blue-300 hover:bg-blue-50 cursor-pointer shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {tenderLink ? (
          <div className="p-3.5 bg-blue-50 border-2 border-blue-500 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-extrabold uppercase text-blue-800">
                Link do ogłoszenia przetargowego
              </div>
              <div title={tenderLink} className="text-xs font-mono text-black truncate mt-0.5">
                {tenderLink}
              </div>
            </div>
            <a
              href={tenderLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-xs shrink-0"
            >
              <ExternalLink size={14} /> Otwórz przetarg
            </a>
          </div>
        ) : (
          <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700">
            Brak bezpośredniego linku URL dla tego ogłoszenia.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
            <div className="text-xs font-bold uppercase">Punktacja</div>
            <div className="text-xs font-extrabold mt-1">{getTenderScoreDisplay(tender)}</div>
            <div className="text-[11px] font-semibold mt-0.5">Suma: {tender.score} pkt</div>
          </div>
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
            <div className="text-xs font-bold uppercase">Data publikacji</div>
            <div className="text-xs font-extrabold mt-1">
              {formatDateTimePl(tender.publicationDate)}
            </div>
          </div>
          <div className="p-3 bg-amber-50/80 border border-amber-300 rounded-xl">
            <div className="text-xs font-bold uppercase">Termin składania</div>
            <div className="text-xs font-extrabold mt-1">
              {tenderDeadline ? formatDateTimePl(tenderDeadline) : 'Brak'}
            </div>
            {hoursBadge && (
              <span
                className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-extrabold ${hoursBadge.cls}`}
              >
                <Clock size={10} /> {hoursBadge.text}
              </span>
            )}
          </div>
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
            <div className="text-xs font-bold uppercase mb-1">Status</div>
            <button
              type="button"
              onClick={(e) => onToggleStatus(e, tender)}
              className={`w-28 py-1 rounded-lg text-xs font-extrabold border-2 cursor-pointer text-center ${
                tender.status === 'INTERESTED'
                  ? 'bg-green-400 border-green-800 text-black'
                  : 'bg-blue-100 border-blue-600 text-black'
              }`}
            >
              {tender.status}
            </button>
          </div>
        </div>

        <MatchedKeywordsSummary
          text={`${tender.title || ''}\n${tender.description || ''}`}
          categories={categories}
          descriptionForFilter={tender.description}
        />

        <div className="space-y-2">
          <div className="text-xs font-extrabold uppercase">
            Pełne szczegóły i metadane ogłoszenia
          </div>
          <div className="p-4 bg-slate-50 border border-blue-200 rounded-xl text-sm whitespace-pre-line leading-relaxed font-medium">
            {tender.description ? (
              <HighlightedText
                text={tender.description}
                categories={categories}
                descriptionForFilter={tender.description}
              />
            ) : (
              'Brak dodatkowego opisu dla tego przetargu.'
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-blue-100">
          <button
            type="button"
            onClick={(e) => onConfirmDelete(e, tender)}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-400 hover:bg-red-500 border-2 border-red-800 text-black font-extrabold rounded-xl text-xs cursor-pointer"
          >
            <Trash2 size={15} /> Usuń ten przetarg
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}
