import { PieChart } from 'lucide-react';

export default function StatusDonutChart({ kpi }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const interestedStroke = kpi.total > 0 ? (kpi.interested / kpi.total) * circumference : 0;
  const newStroke = kpi.total > 0 ? (kpi.newCount / kpi.total) * circumference : 0;

  return (
    <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-blue-200 shadow-xs flex flex-col justify-between">
      <div className="border-b border-blue-100 pb-4">
        <div className="flex items-center gap-2">
          <PieChart size={20} className="text-blue-600" />
          <h3 className="text-lg font-extrabold text-black">
            Rozdział według Statusu (Kołowy 3D)
          </h3>
        </div>
        <p className="text-xs font-semibold text-black mt-0.5">
          Stosunek nowych ogłoszeń (NEW) do oznaczonych jako interesujące (INTERESTED).
        </p>
      </div>

      <div className="my-4 flex flex-col items-center justify-center">
        <div className="relative w-64 h-52 flex items-center justify-center">
          <svg viewBox="0 0 220 190" className="w-full h-full overflow-visible">
            <ellipse cx="110" cy="118" rx="82" ry="52" fill="#cbd5e1" opacity="0.6" />

            {[14, 11, 8, 5, 2].map((offset) => (
              <g key={offset} transform={`translate(0, ${offset}) scale(1, 0.68)`}>
                <circle
                  cx="110"
                  cy="110"
                  r={radius}
                  fill="transparent"
                  stroke="#1e3a8a"
                  strokeWidth="28"
                />
                {kpi.total > 0 && (
                  <circle
                    cx="110"
                    cy="110"
                    r={radius}
                    fill="transparent"
                    stroke="#14532d"
                    strokeWidth="28"
                    strokeDasharray={`${interestedStroke} ${circumference}`}
                    transform="rotate(-90 110 110)"
                  />
                )}
              </g>
            ))}

            <g transform="scale(1, 0.68)">
              <circle
                cx="110"
                cy="110"
                r={radius}
                fill="transparent"
                stroke="#e2e8f0"
                strokeWidth="28"
              />
              {kpi.total > 0 && (
                <circle
                  cx="110"
                  cy="110"
                  r={radius}
                  fill="transparent"
                  stroke="#2563eb"
                  strokeWidth="28"
                  strokeDasharray={`${newStroke} ${circumference}`}
                  strokeDashoffset={-interestedStroke}
                  transform="rotate(-90 110 110)"
                />
              )}
              {kpi.total > 0 && (
                <circle
                  cx="110"
                  cy="110"
                  r={radius}
                  fill="transparent"
                  stroke="#4ade80"
                  strokeWidth="28"
                  strokeDasharray={`${interestedStroke} ${circumference}`}
                  transform="rotate(-90 110 110)"
                />
              )}
            </g>

            <text
              x="110"
              y="72"
              textAnchor="middle"
              className="fill-black font-extrabold text-xl"
            >
              {kpi.total}
            </text>
            <text
              x="110"
              y="88"
              textAnchor="middle"
              className="fill-black font-bold text-[10px] uppercase"
            >
              Przetargów
            </text>
          </svg>
        </div>

        <div className="w-full grid grid-cols-2 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-green-100 border-2 border-green-700 flex items-center justify-between">
            <div>
              <div className="text-xs font-extrabold uppercase">INTERESTED</div>
              <div className="text-lg font-extrabold">{kpi.interested} szt.</div>
            </div>
            <span className="text-xl font-extrabold">{kpi.interestedPct}%</span>
          </div>

          <div className="p-3 rounded-xl bg-blue-100 border-2 border-blue-600 flex items-center justify-between">
            <div>
              <div className="text-xs font-extrabold uppercase">NEW</div>
              <div className="text-lg font-extrabold">{kpi.newCount} szt.</div>
            </div>
            <span className="text-xl font-extrabold">{kpi.newPct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
