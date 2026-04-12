import { useState } from "react";
import type { ProfileDraft } from "../page";

type Props = { draft: ProfileDraft; update: (p: Partial<ProfileDraft>) => void };

const COMMON_INJURIES = [
  "Genou (douleur chronique)",
  "Dos (lombalgie)",
  "Épaule",
  "Hanche",
  "Cheville",
  "Cervicales",
];

export default function StepSante({ draft, update }: Props) {
  const [injuryInput, setInjuryInput] = useState("");

  const toggleInjury = (label: string) => {
    const current = draft.injury_history;
    update({
      injury_history: current.includes(label)
        ? current.filter((i) => i !== label)
        : [...current, label],
    });
  };

  const addCustomInjury = () => {
    const val = injuryInput.trim();
    if (val && !draft.injury_history.includes(val)) {
      update({ injury_history: [...draft.injury_history, val] });
    }
    setInjuryInput("");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Santé & précautions</h2>
        <p className="text-slate-400 text-sm">Ces informations aident à éviter les exercices contre-indiqués.</p>
      </div>

      {/* Zones sensibles */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Zones sensibles ou blessures passées
        </label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {COMMON_INJURIES.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleInjury(label)}
              className={`px-3 py-2.5 rounded-xl text-xs font-medium text-left transition border ${
                draft.injury_history.includes(label)
                  ? "border-orange-500 bg-orange-500/10 text-orange-300"
                  : "border-surface-muted text-slate-400 hover:border-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Ajout libre */}
        <div className="flex gap-2">
          <input
            type="text"
            value={injuryInput}
            onChange={(e) => setInjuryInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomInjury()}
            placeholder="Autre zone… (appuyez Entrée)"
            className="flex-1 bg-surface border border-surface-muted rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={addCustomInjury}
            className="px-4 py-2.5 bg-surface-muted rounded-xl text-slate-300 text-sm hover:bg-slate-600 transition"
          >
            +
          </button>
        </div>
      </div>

      {/* Notes médicales */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Notes médicales <span className="text-slate-500 font-normal">(optionnel)</span>
        </label>
        <textarea
          value={draft.medical_notes}
          onChange={(e) => update({ medical_notes: e.target.value })}
          placeholder="Ex : hypertension légère sous traitement, opération genou droit 2022…"
          rows={3}
          className="w-full bg-surface border border-surface-muted rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
      </div>

      {/* Disclaimer */}
      <div className="bg-surface-card border border-surface-muted rounded-xl p-4 text-xs text-slate-500">
        <span className="text-slate-400 font-semibold">Important : </span>
        Cette application ne remplace pas un avis médical. En cas de douleur persistante
        ou de condition médicale sérieuse, consultez votre médecin avant de commencer.
      </div>
    </div>
  );
}
