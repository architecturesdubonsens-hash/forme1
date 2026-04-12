"use client";

const PHASES = [
  { key: "base",   label: "Base",   weeks: "1–4",  desc: "Technique & fondations",    color: "bg-blue-500",   text: "text-blue-300" },
  { key: "build",  label: "Build",  weeks: "5–8",  desc: "Volume & intensité",        color: "bg-brand-500",  text: "text-brand-300" },
  { key: "peak",   label: "Peak",   weeks: "9–10", desc: "Performance maximale",      color: "bg-orange-500", text: "text-orange-300" },
  { key: "deload", label: "Décharge",weeks: "11",  desc: "Récupération & adaptation", color: "bg-purple-500", text: "text-purple-300" },
];

type Props = {
  currentPhase: string;
  currentWeek: number;
};

export default function PhaseTimeline({ currentPhase, currentWeek }: Props) {
  const phaseIndex = PHASES.findIndex((p) => p.key === currentPhase);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cycle d'entraînement</span>
        <span className="text-xs text-slate-500">Semaine {currentWeek}</span>
      </div>

      {/* Barre de phases */}
      <div className="flex gap-0.5 rounded-xl overflow-hidden h-2">
        {PHASES.map((phase, i) => {
          const widths = [36, 36, 18, 10]; // proportions en %
          return (
            <div
              key={phase.key}
              className={`h-full transition-all ${phase.color} ${i > phaseIndex ? "opacity-20" : i === phaseIndex ? "opacity-100" : "opacity-60"}`}
              style={{ width: `${widths[i]}%` }}
            />
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex gap-2">
        {PHASES.map((phase, i) => (
          <div key={phase.key} className={`flex-1 ${i === phaseIndex ? "opacity-100" : "opacity-40"}`}>
            <div className={`text-xs font-bold ${phase.text}`}>{phase.label}</div>
            <div className="text-xs text-slate-500">sem. {phase.weeks}</div>
          </div>
        ))}
      </div>

      {/* Phase courante */}
      {phaseIndex >= 0 && (
        <div className={`text-xs px-3 py-1.5 rounded-lg inline-block ${PHASES[phaseIndex].color}/10 ${PHASES[phaseIndex].text}`}>
          Phase actuelle : <strong>{PHASES[phaseIndex].label}</strong> — {PHASES[phaseIndex].desc}
        </div>
      )}
    </div>
  );
}
