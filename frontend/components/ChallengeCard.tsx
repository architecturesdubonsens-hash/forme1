"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Milestone = { week: number; title: string; objective: string; done: boolean };

type Challenge = {
  id: string;
  title: string;
  description?: string;
  emoji: string;
  challenge_type: string;
  target_description: string;
  start_date: string;
  target_date: string;
  duration_weeks?: number;
  status: string;
  milestones: Milestone[];
  domains: string[];
};

type Props = {
  challenge: Challenge;
  onToggleMilestone: (challengeId: string, week: number, done: boolean) => void;
  onComplete: (challengeId: string) => void;
};

const DOMAIN_COLORS: Record<string, string> = {
  fat_loss: "bg-orange-500/20 text-orange-300",
  muscle:   "bg-blue-500/20 text-blue-300",
  vo2max:   "bg-brand-500/20 text-brand-300",
  mobility: "bg-purple-500/20 text-purple-300",
};
const DOMAIN_LABELS: Record<string, string> = {
  fat_loss:"Graisse", muscle:"Muscle", vo2max:"VO2max", mobility:"Mobilité",
};

export default function ChallengeCard({ challenge, onToggleMilestone, onComplete }: Props) {
  const [expanded, setExpanded] = useState(false);

  const milestones = challenge.milestones ?? [];
  const done = milestones.filter((m) => m.done).length;
  const total = milestones.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const weeksLeft = Math.max(0, Math.ceil(
    (new Date(challenge.target_date).getTime() - Date.now()) / (7 * 86400000)
  ));
  const isCompleted = challenge.status === "completed";

  return (
    <div className={`bg-surface-card rounded-2xl overflow-hidden border transition ${
      isCompleted ? "border-green-500/30 opacity-70" : "border-surface-muted"
    }`}>
      {/* En-tête */}
      <button className="w-full text-left px-4 py-4" onClick={() => setExpanded((e) => !e)}>
        <div className="flex items-start gap-3">
          <span className="text-3xl">{challenge.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {challenge.domains.map((d) => (
                <span key={d} className={`text-xs px-2 py-0.5 rounded-full ${DOMAIN_COLORS[d] ?? "bg-slate-700 text-slate-300"}`}>
                  {DOMAIN_LABELS[d] ?? d}
                </span>
              ))}
              {isCompleted && <span className="text-xs text-green-400">✓ Accompli</span>}
            </div>
            <h3 className="font-bold text-white text-sm leading-tight">{challenge.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{challenge.target_description}</p>
          </div>
          <span className="text-slate-500 text-xs shrink-0">{expanded ? "▲" : "▼"}</span>
        </div>

        {/* Barre de progression */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{done}/{total} jalons</span>
            <span>{isCompleted ? "Terminé !" : `${weeksLeft} sem. restantes`}</span>
          </div>
          <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isCompleted ? "bg-green-500" : "bg-brand-500"}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
      </button>

      {/* Jalons */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-surface-muted pt-3 space-y-2">
              {/* Description */}
              {challenge.description && (
                <p className="text-sm text-slate-400 pb-2">{challenge.description}</p>
              )}

              {/* Liste des jalons */}
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Jalons hebdomadaires</div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {milestones.map((m) => (
                  <button
                    key={m.week}
                    onClick={() => onToggleMilestone(challenge.id, m.week, !m.done)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                      m.done ? "bg-brand-500/10 border border-brand-500/20" : "bg-surface border border-surface-muted hover:border-slate-500"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition ${
                      m.done ? "border-brand-500 bg-brand-500" : "border-slate-500"
                    }`}>
                      {m.done && <span className="text-white text-xs">✓</span>}
                    </div>
                    <div>
                      <div className={`text-xs font-semibold ${m.done ? "text-brand-400" : "text-slate-300"}`}>
                        Semaine {m.week} — {m.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{m.objective}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Action complétion */}
              {!isCompleted && progress >= 80 && (
                <button
                  onClick={() => onComplete(challenge.id)}
                  className="w-full mt-2 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition"
                >
                  Marquer comme accompli 🎉
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
