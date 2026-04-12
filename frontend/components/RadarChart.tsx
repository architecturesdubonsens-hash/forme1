"use client";

type Axis = { label: string; key: string; color: string };

const AXES: Axis[] = [
  { key: "score_vo2max",   label: "VO2max",    color: "#22c55e" },
  { key: "score_muscle",   label: "Muscle",    color: "#3b82f6" },
  { key: "score_fat_loss", label: "Graisse",   color: "#f97316" },
  { key: "score_mobility", label: "Mobilité",  color: "#a855f7" },
];

type Props = {
  scores: Record<string, number>; // 0–100 par axe
  size?: number;
};

export default function RadarChart({ scores, size = 200 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.38;
  const n  = AXES.length;

  // Coordonnées d'un point sur le radar
  const point = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const dist  = (value / 100) * r;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  };

  // Points de la grille (cercles de référence)
  const gridPoints = (fraction: number) =>
    AXES.map((_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return `${cx + fraction * r * Math.cos(angle)},${cy + fraction * r * Math.sin(angle)}`;
    }).join(" ");

  // Polygone des données
  const dataPoints = AXES.map((ax, i) => {
    const val = scores[ax.key] ?? 0;
    const p = point(i, val);
    return `${p.x},${p.y}`;
  }).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {/* Grilles de référence à 25%, 50%, 75%, 100% */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={gridPoints(f)}
          fill="none"
          stroke="#334155"
          strokeWidth={f === 1 ? 1.5 : 0.8}
          strokeDasharray={f < 1 ? "3,3" : "none"}
        />
      ))}

      {/* Axes radiaux */}
      {AXES.map((_, i) => {
        const outer = point(i, 100);
        return (
          <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y}
            stroke="#334155" strokeWidth={0.8} />
        );
      })}

      {/* Polygone données */}
      <polygon
        points={dataPoints}
        fill="rgba(34,197,94,0.15)"
        stroke="#22c55e"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Points et étiquettes */}
      {AXES.map((ax, i) => {
        const val = scores[ax.key] ?? 0;
        const dp  = point(i, val);
        const lp  = point(i, 118); // étiquette légèrement à l'extérieur
        return (
          <g key={ax.key}>
            {/* Point de donnée */}
            <circle cx={dp.x} cy={dp.y} r={4} fill={ax.color} />
            {/* Étiquette */}
            <text
              x={lp.x} y={lp.y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={size * 0.065} fontWeight="600"
              fill={ax.color}
            >
              {ax.label}
            </text>
            {/* Valeur */}
            <text
              x={lp.x} y={lp.y + size * 0.075}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={size * 0.055} fontWeight="700"
              fill="white"
            >
              {val}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
