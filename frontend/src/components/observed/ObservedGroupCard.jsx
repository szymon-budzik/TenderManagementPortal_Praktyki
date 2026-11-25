import {
  Clock,
  ExternalLink,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  Check,
  X,
  Sparkles,
  ArrowDown,
  ArrowLeftRight,
} from 'lucide-react';
import HighlightedText, { MatchedKeywordsSummary } from '../HighlightedText';
import {
  getCleanDescription,
  getHoursCountdown,
  getLinkFromDescription,
  getScoreBreakdown,
  getSourceFromDescription,
  toLocalDateTimeInputValue,
} from './observedUtils';

export default function ObservedGroupCard({
  entry,
  groupIndex,
  nowMs,
  categories,
  highlightEnabled,
  expandedCards,
  onToggleExpand,
  selectedTenderIds,
  selectedUpdateIds,
  onToggleSelectTender,
  onToggleSelectUpdate,
  editingDeadlineId,
  deadlineInput,
  onStartEditDeadline,
  onDeadlineInputChange,
  onSaveDeadline,
  onCancelEditDeadline,
  onMarkUpdatesRead,
  onOpenDiff,
  onDeleteUpdate,
  onUnobserve,
  onDeleteTender,
}) {
  const tender = entry.tender;
  const updates = entry.updates || [];
  const hasUpdates = updates.length > 0;
  const hasUnread = entry.unreadUpdatesCount > 0 || tender.hasUnreadUpdate;

  const effectiveDeadline = entry.effectiveDeadline || tender.submissionDeadline;
  const groupCountdown = getHoursCountdown(effectiveDeadline, nowMs);

  const origLink = getLinkFromDescription(tender.description);
  const latestUpdateLink = updates
    .map((u) => getLinkFromDescription(u.description))
    .find(Boolean);
  const groupLink = latestUpdateLink || origLink;

  const origSource = getSourceFromDescription(tender.description);
  const origCleanDesc = getCleanDescription(tender.description);
  const origExpanded = Boolean(expandedCards[`orig-${tender.id}`]);
  const isEditingDeadline = editingDeadlineId === tender.id;
  const isOrigSelected = selectedTenderIds.includes(tender.id);

  return (
    <section
      className={`rounded-2xl border-2 shadow-sm overflow-hidden transition ${
        hasUnread
          ? 'border-amber-600 bg-amber-50/40'
          : hasUpdates
          ? 'border-blue-600 bg-blue-50/25'
          : 'border-slate-300 bg-white'
      }`}
    >
      {/* Nagłówek grupy */}
      <div
        className={`px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b-2 ${
          hasUnread
            ? 'bg-amber-200/80 border-amber-500'
            : hasUpdates
            ? 'bg-blue-100/80 border-blue-300'
            : 'bg-slate-100 border-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-[11px] font-extrabold">
            Postępowanie #{groupIndex + 1}
          </span>
          <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-300 text-[11px] font-bold">
            Źródło: {origSource}
          </span>
          {hasUpdates && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-300 border border-amber-800 text-[11px] font-extrabold text-black">
              <Sparkles size={12} />
              Powiązane wersje: {updates.length + 1}
            </span>
          )}
          {hasUnread && (
            <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-extrabold">
              NOWA AKTUALIZACJA
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEditingDeadline ? (
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-blue-500">
              <input
                type="datetime-local"
                value={deadlineInput}
                onChange={(e) => onDeadlineInputChange(e.target.value)}
                className="text-xs font-mono px-2 py-1 border border-blue-300 rounded"
              />
              <button
                type="button"
                onClick={() => onSaveDeadline(tender.id)}
                className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                title="Zapisz termin"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={onCancelEditDeadline}
                className="p-1 bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                title="Anuluj"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <div
                title={
                  effectiveDeadline
                    ? `Termin składania ofert: ${new Date(effectiveDeadline).toLocaleString('pl-PL')}`
                    : 'Brak automatycznego terminu — kliknij ołówek, aby wpisać ręcznie'
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border-2 text-xs font-extrabold ${groupCountdown.badgeClass}`}
              >
                <Clock size={14} />
                <span>{groupCountdown.label}</span>
                {effectiveDeadline && (
                  <span className="font-mono text-[11px] opacity-85">
                    ({new Date(effectiveDeadline).toLocaleString('pl-PL', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  onStartEditDeadline(tender.id, toLocalDateTimeInputValue(effectiveDeadline))
                }
                title="Ustaw / zmień termin składania ofert"
                className="p-1.5 bg-white border border-blue-400 hover:bg-blue-50 rounded-lg cursor-pointer"
              >
                <Pencil size={13} />
              </button>
            </>
          )}

          {groupLink ? (
            <a
              href={groupLink}
              target="_blank"
              rel="noopener noreferrer"
              title={groupLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-extrabold shadow-xs transition"
            >
              <ExternalLink size={14} /> Otwórz przetarg
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/80 border border-slate-300 rounded-lg text-[11px] font-bold text-slate-500">
              Brak linku
            </span>
          )}

          {hasUnread && (
            <button
              type="button"
              onClick={() => onMarkUpdatesRead(tender.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-400 hover:bg-green-500 border-2 border-green-800 rounded-lg text-xs font-extrabold text-black cursor-pointer"
            >
              <CheckCheck size={14} /> Przeczytane
            </button>
          )}
        </div>
      </div>

      {/* Karty: aktualizacje od najnowszej + oryginał poniżej */}
      <div className="p-4 space-y-2">
        {updates.map((upd, updIdx) => {
          const updKey = `upd-${upd.id}`;
          const updExpanded = Boolean(expandedCards[updKey]);
          const updLink = getLinkFromDescription(upd.description) || origLink;
          const updCleanDesc = getCleanDescription(upd.description);
          const updCountdown = getHoursCountdown(upd.submissionDeadline, nowMs);
          const isUnreadCard = !upd.isRead;
          const isUpdSelected = selectedUpdateIds.includes(upd.id);

          return (
            <div key={upd.id} className="space-y-2">
              <div
                className={`rounded-xl border-2 p-4 space-y-3 transition ${
                  isUpdSelected
                    ? 'bg-blue-50/70 border-blue-700 ring-2 ring-blue-400/70'
                    : isUnreadCard
                    ? 'bg-white border-amber-600 shadow-xs ring-2 ring-amber-300/60'
                    : 'bg-white border-blue-500'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <label
                      title="Zaznacz tę aktualizację do raportu"
                      className="flex flex-col items-center gap-0.5 pt-0.5 cursor-pointer shrink-0 select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isUpdSelected}
                        onChange={() => onToggleSelectUpdate(upd.id)}
                        className="w-5 h-5 accent-blue-600 cursor-pointer"
                      />
                      <span className="text-[9px] font-extrabold uppercase text-blue-800">
                        Raport
                      </span>
                    </label>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-300 border-2 border-amber-800 text-xs font-extrabold text-black">
                          <Sparkles size={12} /> AKTUALIZACJA v{upd.versionNumber}
                        </span>
                        {isUnreadCard && (
                          <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold">
                            NOWE
                          </span>
                        )}
                        {upd.externalId && (
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-slate-100 border border-slate-300 rounded">
                            ID: {upd.externalId}
                          </span>
                        )}
                        <span className="text-[11px] font-semibold text-slate-600">
                          Wykryto:{' '}
                          {upd.detectedAt ? new Date(upd.detectedAt).toLocaleString('pl-PL') : '—'}
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold text-black leading-snug pt-0.5">
                        <HighlightedText
                          text={upd.title}
                          categories={categories}
                          descriptionForFilter={tender.description}
                          enabled={highlightEnabled}
                        />
                      </h3>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {upd.submissionDeadline && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold ${updCountdown.badgeClass}`}
                      >
                        <Clock size={12} /> {updCountdown.label}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenDiff(tender, updates, updIdx)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 border-2 border-amber-700 text-black rounded-lg text-xs font-extrabold cursor-pointer"
                    >
                      <ArrowLeftRight size={13} /> Porównaj ze starą wersją
                    </button>
                    {updLink && (
                      <a
                        href={updLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                      >
                        <ExternalLink size={13} /> Otwórz
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteUpdate(upd)}
                      title="Usuń tę wersję aktualizacji"
                      className="p-1.5 bg-white border border-red-300 hover:bg-red-50 rounded-lg text-black cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {upd.changeSummary && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-400 text-xs font-bold text-black">
                    Zmiany: {upd.changeSummary}
                  </div>
                )}

                {updCleanDesc && (
                  <div>
                    <button
                      type="button"
                      onClick={() => onToggleExpand(updKey)}
                      className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700 hover:underline cursor-pointer"
                    >
                      {updExpanded ? (
                        <>
                          <ChevronUp size={14} /> Ukryj pełne szczegóły aktualizacji
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} /> Pokaż pełne szczegóły aktualizacji
                        </>
                      )}
                    </button>
                    {updExpanded && (
                      <pre className="mt-2 p-3 bg-slate-50 border border-blue-200 rounded-xl text-xs font-sans whitespace-pre-wrap break-words leading-relaxed max-h-72 overflow-y-auto">
                        <HighlightedText
                          text={updCleanDesc}
                          categories={categories}
                          descriptionForFilter={tender.description}
                          enabled={highlightEnabled}
                        />
                      </pre>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] font-extrabold text-blue-800 select-none">
                <span className="h-px flex-1 bg-blue-300" />
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 border border-blue-400">
                  <ArrowDown size={12} /> dotyczy tego samego postępowania poniżej
                </span>
                <span className="h-px flex-1 bg-blue-300" />
              </div>
            </div>
          );
        })}

        {/* KARTA ORYGINAŁU */}
        <div
          className={`rounded-xl border-2 p-4 space-y-3 transition ${
            isOrigSelected
              ? 'bg-blue-50/70 border-blue-700 ring-2 ring-blue-400/70'
              : 'bg-white border-slate-300'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <label
                title="Zaznacz ten oryginalny przetarg do raportu"
                className="flex flex-col items-center gap-0.5 pt-0.5 cursor-pointer shrink-0 select-none"
              >
                <input
                  type="checkbox"
                  checked={isOrigSelected}
                  onChange={() => onToggleSelectTender(tender.id)}
                  className="w-5 h-5 accent-blue-600 cursor-pointer"
                />
                <span className="text-[9px] font-extrabold uppercase text-blue-800">Raport</span>
              </label>

              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-green-300 border-2 border-green-800 text-xs font-extrabold text-black">
                    {hasUpdates ? 'ORYGINAŁ (wersja bazowa)' : 'OBSERWOWANY (INTERESTED)'}
                  </span>
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-blue-50 border border-blue-300 rounded">
                    ID: {tender.externalId}
                  </span>
                  <span className="text-[11px] font-extrabold px-2 py-0.5 bg-blue-100 border border-blue-500 rounded">
                    Score: {tender.score} pkt ({getScoreBreakdown(tender)})
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600">
                    Pobrano:{' '}
                    {tender.publicationDate
                      ? new Date(tender.publicationDate).toLocaleString('pl-PL')
                      : '—'}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-black leading-snug pt-0.5">
                  <HighlightedText
                    text={tender.title}
                    categories={categories}
                    descriptionForFilter={tender.description}
                    enabled={highlightEnabled}
                  />
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {origLink && (
                <a
                  href={origLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                >
                  <ExternalLink size={13} /> Otwórz przetarg
                </a>
              )}
              <button
                type="button"
                onClick={() => onUnobserve(tender)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg text-xs font-bold cursor-pointer"
              >
                Przestań obserwować
              </button>
              <button
                type="button"
                onClick={() => onDeleteTender(tender)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-red-400 hover:bg-red-50 text-black rounded-lg text-xs font-bold cursor-pointer"
              >
                <Trash2 size={13} /> Usuń
              </button>
            </div>
          </div>

          <MatchedKeywordsSummary
            text={`${tender.title || ''}\n${origCleanDesc}`}
            categories={categories}
            descriptionForFilter={tender.description}
            enabled={highlightEnabled}
          />

          {origCleanDesc && (
            <div className="space-y-1.5">
              {!origExpanded && (
                <div className="text-xs text-black/80 line-clamp-3 whitespace-pre-line bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <HighlightedText
                    text={origCleanDesc}
                    categories={categories}
                    descriptionForFilter={tender.description}
                    enabled={highlightEnabled}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => onToggleExpand(`orig-${tender.id}`)}
                className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700 hover:underline cursor-pointer"
              >
                {origExpanded ? (
                  <>
                    <ChevronUp size={14} /> Zwiń szczegóły
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> Rozwiń pełne szczegóły
                  </>
                )}
              </button>
              {origExpanded && (
                <pre className="p-3.5 bg-slate-50 border border-blue-200 rounded-xl text-xs font-sans whitespace-pre-wrap break-words leading-relaxed max-h-80 overflow-y-auto">
                  <HighlightedText
                    text={origCleanDesc}
                    categories={categories}
                    descriptionForFilter={tender.description}
                    enabled={highlightEnabled}
                  />
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
