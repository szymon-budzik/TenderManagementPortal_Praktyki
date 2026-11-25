export default function ScoreBracketsChart({ scoreBrackets }) {
  const maxBracketCount = Math.max(1, ...scoreBrackets.map((b) => b.count));

  return (
    <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-blue-200 shadow-xs space-y-4">
      <div className="border-b border-blue-100 pb-3">
        <h3 className="text-lg font-extrabold text-black">
          Rozkład Punktacji Przetargów (Kolumny 3D)
        </h3>
        <p className="text-xs font-semibold text-black">
          Liczba przetargów w poszczególnych przedziałach wag punktowych (Score).
        </p>
      </div>

      <div className="w-full flex justify-center pt-2">
        <svg viewBox="0 0 420 230" className="w-full max-w-md h-56 overflow-visible">
          {[40, 85, 130, 175].map((y, i) => (
            <line
              key={i}
              x1="35"
              y1={y}
              x2="395"
              y2={y}
              stroke="#dbeafe"
              strokeDasharray="4 4"
              strokeWidth="1.5"
            />
          ))}

          <polygon
            points="30,185 45,172 405,172 390,185"
            fill="#eff6ff"
            stroke="#93c5fd"
            strokeWidth="1.5"
          />

          {scoreBrackets.map((b, i) => {
            const maxBarH = 125;
            const barH = Math.max(8, Math.round((b.count / maxBracketCount) * maxBarH));
            const x = 60 + i * 88;
            const yBottom = 180;
            const yTop = yBottom - barH;
            const w = 42;
            const dx = 12;
            const dy = -10;

            return (
              <g key={b.label}>
                <rect
                  x={x}
                  y={yTop}
                  width={w}
                  height={barH}
                  fill={b.color}
                  stroke="#1e3a8a"
                  strokeWidth="1"
                />
                <polygon
                  points={`${x},${yTop} ${x + dx},${yTop + dy} ${x + w + dx},${yTop + dy} ${x + w},${yTop}`}
                  fill={b.top}
                  stroke="#1e3a8a"
                  strokeWidth="1"
                />
                <polygon
                  points={`${x + w},${yTop} ${x + w + dx},${yTop + dy} ${x + w + dx},${yBottom + dy} ${x + w},${yBottom}`}
                  fill={b.side}
                  stroke="#1e3a8a"
                  strokeWidth="1"
                />
                <text
                  x={x + w / 2 + 5}
                  y={yTop + dy - 6}
                  textAnchor="middle"
                  className="fill-black font-extrabold text-xs"
                >
                  {b.count}
                </text>
                <text
                  x={x + w / 2}
                  y={204}
                  textAnchor="middle"
                  className="fill-black font-bold text-[11px]"
                >
                  {b.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
