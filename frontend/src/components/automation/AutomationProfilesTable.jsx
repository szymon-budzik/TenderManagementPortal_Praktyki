import { ArrowUpDown, Bell, BellOff, Play, Pencil, Trash2 } from 'lucide-react';
import CategoryQueryTags from '../common/CategoryQueryTags';
import {
  formatSingleScheduleTag,
  parseCategoryModesMap,
  parseEmailTags,
  parseIdList,
  parseScheduleTags,
} from './automationUtils';

export default function AutomationProfilesTable({
  profiles,
  endpoints,
  categories,
  smtpAccounts,
  loadingAction,
  onToggleSort,
  onToggleEnabled,
  onToggleNotifications,
  onTriggerNow,
  onStartEdit,
  onConfirmDelete,
}) {
  return (
    <div className="rounded-xl border border-blue-200 overflow-hidden">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-blue-600 text-white select-none">
            <th
              onClick={() => onToggleSort('name')}
              className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
            >
              <div className="inline-flex items-center gap-1">
                Profil <ArrowUpDown size={14} />
              </div>
            </th>
            <th
              onClick={() => onToggleSort('cronTime')}
              className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
            >
              <div className="inline-flex items-center gap-1">
                Harmonogram Cron <ArrowUpDown size={14} />
              </div>
            </th>
            <th className="p-3.5 font-bold">Przypisane Endpointy i Kategorie</th>
            <th
              onClick={() => onToggleSort('recipientEmails')}
              className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
            >
              <div className="inline-flex items-center gap-1">
                Odbiorcy i Konto SMTP <ArrowUpDown size={14} />
              </div>
            </th>
            <th
              onClick={() => onToggleSort('enabled')}
              className="p-3.5 font-bold w-36 cursor-pointer hover:bg-blue-700 whitespace-nowrap"
            >
              <div className="inline-flex items-center gap-1">
                Status <ArrowUpDown size={14} />
              </div>
            </th>
            <th className="p-3.5 font-bold text-right whitespace-nowrap">Akcje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-blue-100">
          {profiles.length === 0 ? (
            <tr>
              <td colSpan="6" className="p-6 text-center font-medium text-black">
                Brak utworzonych profili. Stwórz pierwszy profil powyżej.
              </td>
            </tr>
          ) : (
            profiles.map((p) => {
              const epIds = parseIdList(p.endpointIds);
              const catModesMap = parseCategoryModesMap(p.categoryIds, p.matchMode);
              const catIds = Object.keys(catModesMap).map(Number);

              const assignedEndpoints = endpoints.filter((e) => epIds.includes(e.id));
              const catLabels = categories
                .filter((c) => catIds.includes(c.id))
                .map((c) => `${c.name} (${catModesMap[c.id] || 'OR'})`);

              const assignedSmtp = p.smtpAccountId
                ? smtpAccounts.find((s) => Number(s.id) === Number(p.smtpAccountId))
                : null;
              const emailTags = parseEmailTags(p.recipientEmails);
              const isInterval = (p.scheduleType || '').toUpperCase() === 'INTERVAL';
              const rowScheduleTags = parseScheduleTags(p.cronTime);

              return (
                <tr key={p.id} className="hover:bg-blue-50/40">
                  <td className="p-3.5 align-top">
                    <div className="font-extrabold text-black text-base">{p.name}</div>
                    {p.lastRunAt && (
                      <div className="text-[11px] text-blue-800 font-semibold mt-1">
                        Ostatnio: {new Date(p.lastRunAt).toLocaleString('pl-PL')} ({p.lastRunStatus})
                      </div>
                    )}
                  </td>

                  <td className="p-3.5 align-top">
                    {isInterval ? (
                      <span className="px-2.5 py-1 bg-slate-200 border border-slate-400 rounded-md text-xs font-extrabold inline-block">
                        Co {p.intervalMinutes || 60} min
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {rowScheduleTags.map((t, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-slate-200 border border-slate-400 rounded text-[11px] font-bold text-black"
                          >
                            {formatSingleScheduleTag(t)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="p-3.5 align-top space-y-1.5 text-xs">
                    <div>
                      <span className="font-extrabold">
                        Endpointy ({assignedEndpoints.length}):{' '}
                      </span>
                      {assignedEndpoints.length === 0 ? (
                        <span>Brak</span>
                      ) : (
                        <span className="inline-flex flex-wrap gap-1 align-middle">
                          {assignedEndpoints.map((e) => (
                            <span
                              key={e.id}
                              className={`px-1.5 py-0.5 rounded border text-[11px] font-semibold ${
                                e.isActive
                                  ? 'bg-slate-100 border-slate-300 text-black'
                                  : 'bg-red-100 border-red-500 text-red-900 font-bold'
                              }`}
                            >
                              {e.name}
                              {!e.isActive && ' (WYŁĄCZONY)'}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                    <div>
                      {p.useCategoryQuery && p.categoryQuery ? (
                        <div className="space-y-1">
                          <span className="font-extrabold">Zapytanie kategorii: </span>
                          <CategoryQueryTags
                            query={p.categoryQuery}
                            categories={categories}
                            compact={true}
                          />
                        </div>
                      ) : (
                        <>
                          <span className="font-extrabold">Kategorie ({catLabels.length}): </span>
                          <span>{catLabels.join(', ') || 'Brak'}</span>
                        </>
                      )}
                    </div>
                  </td>

                  <td className="p-3.5 text-xs align-top space-y-1.5">
                    <div className="text-[11px] font-extrabold text-blue-800">
                      SMTP: {assignedSmtp ? assignedSmtp.name : 'Brak SMTP'}
                    </div>
                    {assignedSmtp && emailTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {emailTags.map((em, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-slate-200 border border-slate-400 rounded text-[11px] font-bold text-black"
                          >
                            {em}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>

                  <td className="p-3.5 align-top">
                    <div className="flex flex-col gap-1.5 items-start">
                      <button
                        type="button"
                        onClick={() => onToggleEnabled(p)}
                        className={`w-28 text-center py-1.5 rounded-lg text-xs font-extrabold border-2 transition cursor-pointer ${
                          p.enabled
                            ? 'bg-green-400 hover:bg-green-500 border-green-800 text-black'
                            : 'bg-red-400 hover:bg-red-500 border-red-800 text-black'
                        }`}
                      >
                        {p.enabled ? 'AKTYWNY' : 'WYŁĄCZONY'}
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleNotifications(p)}
                        title="Kliknij, aby włączyć lub wyłączyć powiadomienia dla tego profilu"
                        className={`w-28 inline-flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-extrabold border transition cursor-pointer ${
                          p.notificationsEnabled !== false
                            ? 'bg-blue-50 hover:bg-blue-100 border-blue-400 text-black'
                            : 'bg-slate-200 hover:bg-slate-300 border-slate-400 text-slate-600'
                        }`}
                      >
                        {p.notificationsEnabled !== false ? (
                          <>
                            <Bell size={12} className="text-blue-700" /> Powiad.: TAK
                          </>
                        ) : (
                          <>
                            <BellOff size={12} className="text-slate-500" /> Powiad.: NIE
                          </>
                        )}
                      </button>
                    </div>
                  </td>

                  <td className="p-3.5 text-right whitespace-nowrap align-top">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={loadingAction}
                        onClick={() => onTriggerNow(p)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 border-2 border-amber-500 text-black rounded-lg font-extrabold text-xs cursor-pointer"
                      >
                        <Play size={13} /> Uruchom
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartEdit(p)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                      >
                        <Pencil size={13} /> Edytuj
                      </button>
                      <button
                        type="button"
                        onClick={() => onConfirmDelete(p)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-400 hover:bg-red-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                      >
                        <Trash2 size={13} /> Usuń
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
  );
}
