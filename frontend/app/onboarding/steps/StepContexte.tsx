"use client";
import type { ProfileDraft } from "../page";

type Props = { draft: ProfileDraft; update: (p: Partial<ProfileDraft>) => void };

export default function StepContexte({ draft, update }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Contexte d'entraînement</h2>
        <p className="text-slate-400 text-sm">
          Ce programme sera-t-il votre seul entraînement ou un complément ?
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => update({ existing_training: false, existing_training_context: "" })}
          className={`w-full p-4 rounded-xl border text-left transition ${
            !draft.existing_training
              ? "border-brand-500 bg-brand-500/10"
              : "border-surface-muted bg-surface-card hover:border-slate-500"
          }`}
        >
          <div className="font-medium text-white">Programme principal</div>
          <div className="text-xs text-slate-400 mt-0.5">C'est mon seul entraînement structuré</div>
        </button>

        <button
          onClick={() => update({ existing_training: true })}
          className={`w-full p-4 rounded-xl border text-left transition ${
            draft.existing_training
              ? "border-brand-500 bg-brand-500/10"
              : "border-surface-muted bg-surface-card hover:border-slate-500"
          }`}
        >
          <div className="font-medium text-white">Programme complémentaire</div>
          <div className="text-xs text-slate-400 mt-0.5">Je pratique déjà un sport ou un entraînement régulier</div>
        </button>
      </div>

      {draft.existing_training && (
        <div className="space-y-2">
          <p className="text-sm text-slate-300">
            Décrivez votre pratique et l'objectif de ce complément
          </p>
          <textarea
            value={draft.existing_training_context}
            onChange={(e) => update({ existing_training_context: e.target.value })}
            placeholder="Ex : tennis 2×/sem + course 30 min le matin. Objectif du complément : renforcer les épaules et améliorer la mobilité."
            className="w-full bg-surface-muted border border-surface-muted rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
            rows={4}
          />
        </div>
      )}
    </div>
  );
}
