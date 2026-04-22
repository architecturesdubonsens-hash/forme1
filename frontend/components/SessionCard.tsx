"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { submitFeedback } from "@/lib/api";

const TYPE_COLORS: Record<string, string> = {
  strength:       "bg-blue-500/20 text-blue-300 border-blue-500/30",
  cardio:         "bg-green-500/20 text-green-300 border-green-500/30",
  hiit:           "bg-orange-500/20 text-orange-300 border-orange-500/30",
  mobility:       "bg-purple-500/20 text-purple-300 border-purple-500/30",
  mixed:          "bg-brand-500/20 text-brand-300 border-brand-500/30",
  active_recovery:"bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const TYPE_LABELS: Record<string, string> = {
  strength:       "Force",
  cardio:         "Cardio",
  hiit:           "HIIT",
  mobility:       "Mobilité",
  mixed:          "Mixte",
  active_recovery:"Récup. active",
};

const INTENSITY_DOTS: Record<string, number> = {
  low: 1, moderate: 2, high: 3, max: 4,
};

type Exercise = {
  name_fr?: string;
  block: string;
  sets?: number;
  reps_min?: number;
  reps_max?: number;
  duration_sec?: number;
  rest_sec?: number;
  rpe_target?: number;
  load_notes?: string;
  demo_url?: string;
  cues?: string[];
};

type Session = {
  id: string;
  day_of_week: number;
  session_type: string;
  title: string;
  goal_summary?: string;
  estimated_duration_min?: number;
  intensity_target: string;
  status: string;
  exercises?: Exercise[];
  session_exercises?: Exercise[];
};

type Props = {
  session: Session;
  dayLabel: string;
  isToday: boolean;
  userId: string;
  onFeedbackSubmit: () => void;
};

export default function SessionCard({ session, dayLabel, isToday, userId, onFeedbackSubmit }: Props) {
  const [expanded, setExpanded] = useState(isToday && session.status === "planned");
  const router = useRouter();
  const [showFeedback, setShowFeedback] = useState(false);
  const [rpe, setRpe] = useState(6);
  const [energy, setEnergy] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  const colorClass = TYPE_COLORS[session.session_type] ?? TYPE_COLORS.mixed;
  const typeLabel = TYPE_LABELS[session.session_type] ?? session.session_type;
  const exercises: Exercise[] = session.exercises ?? session.session_exercises ?? [];
  const isCompleted = session.status === "completed";
  const isSkipped   = session.status === "skipped";

  const handleFeedback = async () => {
    setSubmitting(true);
    try {
      await submitFeedback(userId, session.id, {
        rpe_actual: rpe,
        energy_level: energy,
        motivation_score: energy,
        completed_fully: true,
      });
      setShowFeedback(false);
      onFeedbackSubmit();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border transition ${
        isToday
          ? "border-brand-500/50 bg-brand-500/5"
          : "border-surface-muted bg-surface-card"
      } ${isCompleted ? "opacity-60" : ""}`}
    >
      {/* En-tête cliquable */}
      <button
        className="w-full text-left px-4 py-4"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          {/* Jour */}
          <div className={`text-center min-w-10 ${isToday ? "text-brand-400" : "text-slate-500"}`}>
            <div className="text-xs font-medium uppercase">{dayLabel}</div>
            {isToday && <div className="w-1.5 h-1.5 bg-brand-400 rounded-full mx-auto mt-1" />}
          </div>

          {/* Infos */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${colorClass}`}>
                {typeLabel}
              </span>
              {isCompleted && <span className="text-xs text-green-400">✓ Complétée</span>}
              {isSkipped   && <span className="text-xs text-slate-500">— Sautée</span>}
            </div>
            <h3 className="text-sm font-semibold text-white truncate">{session.title}</h3>
            {session.goal_summary && (
              <p className="text-xs text-slate-400 truncate mt-0.5">{session.goal_summary}</p>
            )}
          </div>

          {/* Durée + intensité */}
          <div className="text-right shrink-0">
            {session.estimated_duration_min && (
              <div className="text-xs text-slate-400">{session.estimated_duration_min} min</div>
            )}
            <div className="flex gap-0.5 mt-1 justify-end">
              {[1, 2, 3, 4].map((d) => (
                <div
                  key={d}
                  className={`w-1 h-3 rounded-sm ${
                    d <= (INTENSITY_DOTS[session.intensity_target] ?? 2)
                      ? "bg-brand-400"
                      : "bg-surface-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </button>

      {/* Détail des exercices */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t border-surface-muted pt-3">
              {exercises.length === 0 && (
                <p className="text-xs text-slate-500">Détail des exercices non disponible.</p>
              )}

              {["warmup", "main", "cooldown"].map((block) => {
                const blockEx = exercises.filter((e) => e.block === block);
                if (blockEx.length === 0) return null;
                return (
                  <div key={block}>
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">
                      {block === "warmup" ? "Échauffement" : block === "main" ? "Travail principal" : "Retour au calme"}
                    </div>
                    {blockEx.map((ex, i) => (
                      <ExerciseRow key={i} ex={ex} />
                    ))}
                  </div>
                );
              })}

              {/* Lien détail */}
              {session.id && (
                <button
                  onClick={() => router.push(`/session/${session.id}`)}
                  className="w-full mt-2 py-2 rounded-xl border border-surface-muted text-slate-400 text-xs hover:border-slate-500 hover:text-slate-300 transition"
                >
                  Voir le détail complet →
                </button>
              )}

              {/* CTA feedback */}
              {!isCompleted && !isSkipped && !showFeedback && (
                <button
                  onClick={() => setShowFeedback(true)}
                  className="w-full mt-2 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition"
                >
                  Séance terminée — donner mon feedback
                </button>
              )}

              {/* Formulaire feedback rapide */}
              {showFeedback && (
                <div className="mt-2 space-y-3 bg-surface rounded-xl p-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-2">
                      Effort perçu (RPE) : <span className="text-white font-bold">{rpe}/10</span>
                    </label>
                    <input type="range" min={1} max={10} value={rpe}
                      onChange={(e) => setRpe(+e.target.value)}
                      className="w-full accent-brand-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-2">
                      Niveau d'énergie : <span className="text-white font-bold">{energy}/5</span>
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setEnergy(n)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                            energy === n ? "bg-brand-500 text-white" : "bg-surface-muted text-slate-400"
                          }`}>
                          {["😴", "😕", "😐", "😊", "🔥"][n - 1]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleFeedback} disabled={submitting}
                    className="w-full py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition disabled:opacity-50">
                    {submitting ? "Enregistrement…" : "Valider"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExerciseRow({ ex }: { ex: Exercise }) {
  const [showCues, setShowCues] = useState(false);

  const prescription = [
    ex.sets && ex.reps_min ? `${ex.sets}×${ex.reps_min}${ex.reps_max && ex.reps_max !== ex.reps_min ? `–${ex.reps_max}` : ""}` : null,
    ex.duration_sec ? `${ex.duration_sec}s` : null,
    ex.rest_sec ? `repos ${ex.rest_sec}s` : null,
    ex.rpe_target ? `RPE ${ex.rpe_target}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="mb-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white font-medium">{ex.name_fr ?? "Exercice"}</span>
            {ex.demo_url && (
              <a href={ex.demo_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-brand-400 hover:text-brand-300 transition">
                ▶ démo
              </a>
            )}
            {ex.cues && ex.cues.length > 0 && (
              <button onClick={() => setShowCues((s) => !s)}
                className="text-xs text-slate-500 hover:text-slate-400 transition">
                {showCues ? "▲" : "▼"} conseils
              </button>
            )}
          </div>
          {prescription && <p className="text-xs text-slate-400 mt-0.5">{prescription}</p>}
          {ex.load_notes && <p className="text-xs text-slate-300 mt-0.5">{ex.load_notes}</p>}
          {showCues && ex.cues && (
            <ul className="mt-1.5 space-y-0.5">
              {ex.cues.map((cue, i) => (
                <li key={i} className="text-xs text-slate-400 flex gap-1.5">
                  <span className="text-brand-400 shrink-0">·</span> {cue}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
