import type { ProfileDraft } from "../page";

type Props = { draft: ProfileDraft; update: (p: Partial<ProfileDraft>) => void };

const DURATIONS = [30, 45, 60, 75, 90];

export default function StepDisponibilite({ draft, update }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Votre disponibilité</h2>
        <p className="text-slate-400 text-sm">Un programme réaliste est un programme qu'on fait.</p>
      </div>

      {/* Séances par semaine */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Séances par semaine : <span className="text-brand-400 font-bold">{draft.sessions_per_week}</span>
        </label>
        <div className="flex gap-2">
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => update({ sessions_per_week: n })}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition ${
                draft.sessions_per_week === n
                  ? "bg-brand-500 text-white"
                  : "bg-surface border border-surface-muted text-slate-400 hover:border-slate-500"
              }`}
            >
              {n}×
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {draft.sessions_per_week <= 3
            ? "Bien — la qualité prime sur la quantité."
            : draft.sessions_per_week <= 4
            ? "Excellent équilibre stimulus / récupération."
            : "Ambitieux — assurez-vous d'avoir des jours de repos."}
        </p>
      </div>

      {/* Durée préférée */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Durée préférée par séance
        </label>
        <div className="grid grid-cols-5 gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => update({ session_duration_min: d })}
              className={`py-3 rounded-xl text-xs font-semibold transition ${
                draft.session_duration_min === d
                  ? "bg-brand-500 text-white"
                  : "bg-surface border border-surface-muted text-slate-400 hover:border-slate-500"
              }`}
            >
              {d} min
            </button>
          ))}
        </div>
      </div>

      {/* Rappel récupération */}
      <div className="bg-surface-card border border-surface-muted rounded-xl p-4 text-sm text-slate-400">
        <span className="text-brand-400 font-semibold">Note :</span> Le programme inclut automatiquement
        des séances de récupération active et une semaine de décharge toutes les 4–6 semaines.
        Pas besoin de planifier le repos vous-même.
      </div>
    </div>
  );
}
