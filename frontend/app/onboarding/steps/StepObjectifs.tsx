import { useState, useEffect } from "react";
import type { ProfileDraft } from "../page";

type Props = { draft: ProfileDraft; update: (p: Partial<ProfileDraft>) => void };

type GoalKey = "goal_fat_loss" | "goal_muscle" | "goal_mobility" | "goal_vo2max";

const GOALS: { key: GoalKey; label: string; desc: string; color: string }[] = [
  { key: "goal_fat_loss", label: "Perte de graisse viscérale", desc: "Réduire la graisse abdominale profonde", color: "bg-orange-500" },
  { key: "goal_muscle",   label: "Masse musculaire",          desc: "Lutter contre la sarcopénie, se tonifier",  color: "bg-blue-500" },
  { key: "goal_mobility", label: "Mobilité & proprioception",  desc: "Équilibre, coordination, amplitude articulaire", color: "bg-purple-500" },
  { key: "goal_vo2max",   label: "Endurance (VO2max)",        desc: "Capacité cardio-respiratoire",              color: "bg-brand-500" },
];

export default function StepObjectifs({ draft, update }: Props) {
  const total = GOALS.reduce((s, g) => s + draft[g.key], 0);
  const balanced = total === 100;

  const setGoal = (key: GoalKey, value: number) => {
    // Ajuste les autres objectifs proportionnellement pour maintenir la somme à 100
    const others = GOALS.filter((g) => g.key !== key);
    const remaining = 100 - value;
    const currentOthersTotal = others.reduce((s, g) => s + draft[g.key], 0);

    const patch: Partial<ProfileDraft> = { [key]: value } as Partial<ProfileDraft>;
    if (currentOthersTotal > 0) {
      others.forEach((g) => {
        patch[g.key] = Math.round((draft[g.key] / currentOthersTotal) * remaining) as never;
      });
      // Correction d'arrondi
      const newTotal = value + others.reduce((s, g) => s + (patch[g.key] as number ?? draft[g.key]), 0);
      const diff = 100 - newTotal;
      if (diff !== 0) {
        const adjust = others[0].key;
        (patch[adjust] as number) = ((patch[adjust] as number) ?? draft[adjust]) + diff;
      }
    }
    update(patch);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Vos objectifs</h2>
        <p className="text-slate-400 text-sm">
          Répartissez 100 points selon vos priorités. Les curseurs s'ajustent automatiquement.
        </p>
      </div>

      <div className="space-y-4">
        {GOALS.map((g) => (
          <div key={g.key}>
            <div className="flex justify-between items-center mb-1">
              <div>
                <span className="text-sm font-medium text-white">{g.label}</span>
                <span className="text-xs text-slate-500 ml-2">{g.desc}</span>
              </div>
              <span className="text-sm font-bold text-white w-10 text-right">{draft[g.key]}%</span>
            </div>
            <div className="relative">
              <input
                type="range"
                min={0} max={100} step={5}
                value={draft[g.key]}
                onChange={(e) => setGoal(g.key, +e.target.value)}
                className="w-full accent-brand-500 h-2 cursor-pointer"
              />
              <div
                className={`h-1.5 rounded-full ${g.color} absolute top-1/2 left-0 -translate-y-1/2 pointer-events-none`}
                style={{ width: `${draft[g.key]}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Indicateur de total */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium ${
        balanced ? "bg-brand-500/10 text-brand-400" : "bg-red-500/10 text-red-400"
      }`}>
        <span>Total</span>
        <span>{total} / 100 {!balanced && "— ajustez les curseurs"}</span>
      </div>
    </div>
  );
}
