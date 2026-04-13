"use client";

const CATEGORY_COLORS: Record<string, string> = {
  mobility:   "text-purple-400 bg-purple-400/10 border-purple-400/20",
  strength:   "text-blue-400   bg-blue-400/10   border-blue-400/20",
  cardio:     "text-red-400    bg-red-400/10    border-red-400/20",
  posture:    "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  breathing:  "text-teal-400   bg-teal-400/10   border-teal-400/20",
  stretching: "text-orange-400 bg-orange-400/10 border-orange-400/20",
};

const CATEGORY_LABELS: Record<string, string> = {
  mobility:   "Mobilité",
  strength:   "Force",
  cardio:     "Cardio",
  posture:    "Posture",
  breathing:  "Respiration",
  stretching: "Étirements",
};

export interface SnackActivity {
  id: string;
  name: string;
  tagline: string;
  duration_min: number;
  category: string;
  contexts: string[];
  equipment: string[];
  steps: { instruction: string; duration_sec: number }[];
  benefits: string | null;
  emoji: string;
}

interface SnackCardProps {
  snack: SnackActivity;
  onPlay: (snack: SnackActivity) => void;
  compact?: boolean;
}

export default function SnackCard({ snack, onPlay, compact = false }: SnackCardProps) {
  const colorClass = CATEGORY_COLORS[snack.category] ?? "text-slate-400 bg-slate-400/10 border-slate-400/20";

  if (compact) {
    return (
      <button
        onClick={() => onPlay(snack)}
        className="w-full text-left bg-surface-card rounded-xl p-3 flex items-center gap-3 hover:bg-surface-muted transition border border-transparent hover:border-surface-muted"
      >
        <span className="text-2xl flex-shrink-0">{snack.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{snack.name}</p>
          <p className="text-xs text-slate-400 truncate">{snack.tagline}</p>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className="text-xs font-bold text-brand-400">{snack.duration_min} min</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full border ${colorClass}`}>
            {CATEGORY_LABELS[snack.category] ?? snack.category}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="bg-surface-card rounded-2xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-3xl flex-shrink-0">{snack.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-base leading-tight">{snack.name}</h3>
          <p className="text-sm text-slate-400 mt-0.5">{snack.tagline}</p>
        </div>
        <span className="text-lg font-black text-brand-400 flex-shrink-0">{snack.duration_min}<span className="text-xs font-normal text-slate-500"> min</span></span>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${colorClass}`}>
          {CATEGORY_LABELS[snack.category] ?? snack.category}
        </span>
        {snack.contexts.slice(0, 2).map((ctx) => (
          <span key={ctx} className="text-xs px-2 py-0.5 rounded-full border border-surface-muted text-slate-500">
            {CTX_LABELS[ctx] ?? ctx}
          </span>
        ))}
        <span className="text-xs text-slate-500 ml-auto">{snack.steps.length} étapes</span>
      </div>

      {/* Benefits */}
      {snack.benefits && (
        <p className="text-xs text-slate-500 italic leading-relaxed">{snack.benefits}</p>
      )}

      {/* CTA */}
      <button
        onClick={() => onPlay(snack)}
        className="w-full py-2.5 bg-brand-500 rounded-xl font-semibold text-white text-sm hover:bg-brand-600 transition"
      >
        Lancer ▶
      </button>
    </div>
  );
}

const CTX_LABELS: Record<string, string> = {
  office:  "Bureau",
  home:    "Maison",
  travel:  "Voyage",
  hotel:   "Hôtel",
  outdoor: "Extérieur",
  any:     "Partout",
};
