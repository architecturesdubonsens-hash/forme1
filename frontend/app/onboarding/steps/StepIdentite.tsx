import type { ProfileDraft } from "../page";

type Props = { draft: ProfileDraft; update: (p: Partial<ProfileDraft>) => void };

const FITNESS_LEVELS = [
  { value: "sedentary", label: "Sédentaire", desc: "Peu ou pas d'activité physique" },
  { value: "light",     label: "Léger",      desc: "Activité occasionnelle (1–2x/sem)" },
  { value: "moderate",  label: "Modéré",     desc: "Activité régulière (3x/sem)" },
  { value: "active",    label: "Actif",      desc: "Entraînement fréquent (4–5x/sem)" },
  { value: "athlete",   label: "Athlète",    desc: "Entraînement quotidien ou compétition" },
];

export default function StepIdentite({ draft, update }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Qui êtes-vous ?</h2>
        <p className="text-slate-400 text-sm">Ces infos permettent de calibrer votre programme.</p>
      </div>

      {/* Prénom */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Prénom</label>
        <input
          type="text"
          value={draft.first_name}
          onChange={(e) => update({ first_name: e.target.value })}
          placeholder="Votre prénom"
          className="w-full bg-surface border border-surface-muted rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Année de naissance + Genre */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Née en</label>
          <input
            type="number"
            value={draft.birth_year}
            onChange={(e) => update({ birth_year: +e.target.value })}
            min={1940} max={2005}
            className="w-full bg-surface border border-surface-muted rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Genre</label>
          <select
            value={draft.gender}
            onChange={(e) => update({ gender: e.target.value })}
            className="w-full bg-surface border border-surface-muted rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="male">Homme</option>
            <option value="female">Femme</option>
            <option value="other">Autre</option>
          </select>
        </div>
      </div>

      {/* Poids + Taille */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Poids (kg)</label>
          <input
            type="number"
            value={draft.weight_kg}
            onChange={(e) => update({ weight_kg: +e.target.value })}
            min={40} max={250}
            className="w-full bg-surface border border-surface-muted rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Taille (cm)</label>
          <input
            type="number"
            value={draft.height_cm}
            onChange={(e) => update({ height_cm: +e.target.value })}
            min={140} max={220}
            className="w-full bg-surface border border-surface-muted rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Niveau de forme */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Niveau de forme actuel</label>
        <div className="space-y-2">
          {FITNESS_LEVELS.map((lvl) => (
            <button
              key={lvl.value}
              type="button"
              onClick={() => update({ fitness_level: lvl.value })}
              className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                draft.fitness_level === lvl.value
                  ? "border-brand-500 bg-brand-500/10 text-white"
                  : "border-surface-muted text-slate-400 hover:border-slate-500"
              }`}
            >
              <span className="font-medium text-sm">{lvl.label}</span>
              <span className="text-xs text-slate-500 ml-2">{lvl.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
