import { useState, useEffect } from 'react';
import api from '../api';

export default function AnalyticsView() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/analytics/summary')
      .then((res) => setStats(res.data))
      .catch((err) => console.error('Błąd pobierania statystyk:', err));
  }, []);

  if (!stats) {
    return <div className="font-bold text-black">Ładowanie statystyk...</div>;
  }

  const statusEntries = Object.entries(stats.countByStatus || {});

  return (
    <div className="space-y-6 text-black">
      <h2 className="text-2xl font-bold text-black">Statystyki i Analityka</h2>

      {/* Kafelki KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border-2 border-blue-600 shadow-xs">
          <div className="text-sm font-bold uppercase text-black">Wszystkie Przetargi</div>
          <div className="text-4xl font-extrabold text-black mt-2">{stats.totalTenders}</div>
        </div>

        <div className="bg-white p-6 rounded-xl border-2 border-blue-600 shadow-xs">
          <div className="text-sm font-bold uppercase text-black">Średnia Punktacja (Score)</div>
          <div className="text-4xl font-extrabold text-black mt-2">{stats.averageScore} pkt</div>
        </div>

        <div className="bg-white p-6 rounded-xl border-2 border-blue-600 shadow-xs">
          <div className="text-sm font-bold uppercase text-black">Wysoki Priorytet (Score ≥ 30)</div>
          <div className="text-4xl font-extrabold text-black mt-2">{stats.highPriorityCount}</div>
        </div>
      </div>

      {/* Rozkład po statusach */}
      <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-xs">
        <h3 className="text-lg font-bold text-black mb-4">Rozkład przetargów według statusu</h3>
        <div className="space-y-4">
          {statusEntries.map(([status, count]) => {
            const percentage = stats.totalTenders > 0
              ? Math.round((count / stats.totalTenders) * 100)
              : 0;
            return (
              <div key={status} className="space-y-1">
                <div className="flex justify-between text-sm font-bold text-black">
                  <span>{status}</span>
                  <span>{count} ({percentage}%)</span>
                </div>
                <div className="w-full h-3 bg-blue-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}