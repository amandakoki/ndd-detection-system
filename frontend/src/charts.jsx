/* Line chart: progress over time (values from 0 to 100, at least 2 points) */
export function LineChart({ points }) {
  const W = 320;
  const H = 160;
  const pad = { l: 30, r: 10, t: 10, b: 26 };
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1);
  const y = (v) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="line-chart"
      role="img"
      aria-label="Progress trend over time"
    >
      {[0, 50, 100].map((tick) => (
        <g key={tick}>
          <line x1={pad.l} x2={W - pad.r} y1={y(tick)} y2={y(tick)} className="grid" />
          <text x={pad.l - 6} y={y(tick) + 4} textAnchor="end" className="axis">
            {tick}
          </text>
        </g>
      ))}
      <path d={path} className="line" fill="none" />
      {points.map((p, i) => (
        <g key={`${p.label}-${i}`}>
          <circle cx={x(i)} cy={y(p.value)} r="3.5" className="dot" />
          <text x={x(i)} y={H - 8} textAnchor="middle" className="axis">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}