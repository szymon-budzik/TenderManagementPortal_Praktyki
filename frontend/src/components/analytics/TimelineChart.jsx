export default function TimelineChart({ timelineData }) {
  const maxTimelineCount = Math.max(1, ...timelineData.map((d) => d.total));

  return (
    <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-blue-200 shadow-xs space-y-4">
      <div className="border-b border-blue-100 pb-3">
        <h3 className="text-lg font-extrabold text-black">
          Dynamika Ogłoszeń w Czasie (NEW vs INTERESTED)
        </h3>
        <p className="text-xs font-semibold text-black">
          Rozkład dzienny przetargów w wybranym oknie czasowym (ostatnie 10 aktywnych dni).
        </p>
      </div>

      {timelineData.length === 0 ? (
        <div className="p-8 text-center text-sm font-semibold">
          Brak danych czasowych w wybranym zakresie dat.
        </div>
      ) : (
        <div className="h-56 flex items-end justify-between gap-2 pt-6 px-2 border-b-2 border-blue-200">
          {timelineData.map((day) => {
            const totalH = Math.max(12, Math.round((day.total / maxTimelineCount) * 150));
            const intH = day.total > 0 ? Math.round((day.interested / day.total) * totalH) : 0;
            const newH = totalH - intH;

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center justify-end gap-1.5"
              >
                <span className="text-[11px] font-extrabold text-black">{day.total}</span>
                <div
                  style={{ height: `${totalH}px` }}
                  className="w-full max-w-[38px] rounded-t-lg overflow-hidden border border-blue-800 flex flex-col shadow-xs"
                  title={`${day.date} — Łącznie: ${day.total} (INTERESTED: ${day.interested}, NEW: ${day.newCount})`}
                >
                  {newH > 0 && <div style={{ height: `${newH}px` }} className="w-full bg-blue-600" />}
                  {intH > 0 && (
                    <div
                      style={{ height: `${intH}px` }}
                      className="w-full bg-green-400 border-t border-green-800"
                    />
                  )}
                </div>
                <span className="text-[10px] font-bold text-black pb-2">{day.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
