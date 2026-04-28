"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { submitFeedback } from "@/lib/api";
import HealthAlertModal from "@/components/HealthAlertModal";

const TYPE_LABELS: Record<string, string> = {
  strength:"Force", cardio:"Cardio", hiit:"HIIT",
  mobility:"Mobilité", mixed:"Mixte", active_recovery:"Récup. active",
};
const BLOCK_LABELS: Record<string, string> = {
  warmup:"Échauffement", main:"Travail principal", cooldown:"Retour au calme",
};
const DOMAIN_LABELS: Record<string, {label:string;color:string}> = {
  fat_loss:  { label:"Graisse viscérale", color:"text-orange-400" },
  muscle:    { label:"Masse musculaire",  color:"text-blue-400" },
  vo2max:    { label:"VO2max",            color:"text-brand-400" },
  mobility:  { label:"Mobilité",          color:"text-purple-400" },
};

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession]     = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);
  const [userId, setUserId]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [rpe, setRpe]             = useState(6);
  const [energy, setEnergy]       = useState(3);
  const [pain, setPain]           = useState(false);
  const [notes, setNotes]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alertExercise, setAlertExercise] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      setUserId(user.id);

      const { data: s } = await supabase
        .from("sessions")
        .select("*, weekly_plans(phase, week_number)")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      const { data: ex } = await supabase
        .from("session_exercises")
        .select("*")
        .eq("session_id", id)
        .order("position");

      setSession(s);
      setExercises(ex ?? []);
      setLoading(false);
    };
    load();
  }, [id, router]);

  const handleFeedback = async () => {
    if (!userId) return;
    setSubmitting(true);
    await submitFeedback(userId, id, { rpe_actual: rpe, energy_level: energy, motivation_score: energy, pain_reported: pain, completed_fully: true, notes });
    setSubmitting(false);
    router.push("/dashboard");
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!session) return (
    <div className="flex items-center justify-center min-h-screen text-slate-400">Séance introuvable.</div>
  );

  const blocks = ["warmup", "main", "cooldown"] as const;
  const isCompleted = session.status === "completed";
  const domains: string[] = session.objectives_targeted ?? [];

  return (
    <div className="min-h-screen pb-12 max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur px-4 py-4 border-b border-surface-muted">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white transition text-lg">←</button>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-500 uppercase tracking-wider">{TYPE_LABELS[session.session_type]}</div>
            <h1 className="font-bold text-white truncate">{session.title}</h1>
          </div>
          {isCompleted && <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full">✓ Complétée</span>}
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Infos rapides */}
        <div className="flex gap-3">
          {session.estimated_duration_min && (
            <div className="flex-1 bg-surface-card rounded-xl p-3 text-center">
              <div className="text-xl font-black text-white">{session.estimated_duration_min}</div>
              <div className="text-xs text-slate-400">minutes</div>
            </div>
          )}
          <div className="flex-1 bg-surface-card rounded-xl p-3 text-center">
            <div className="text-xl font-black text-white capitalize">{session.intensity_target}</div>
            <div className="text-xs text-slate-400">intensité</div>
          </div>
          <div className="flex-1 bg-surface-card rounded-xl p-3 text-center">
            <div className="text-xl font-black text-white">{exercises.length}</div>
            <div className="text-xs text-slate-400">exercices</div>
          </div>
        </div>

        {/* Objectif de la séance */}
        {session.goal_summary && (
          <div className="bg-surface-card rounded-xl px-4 py-3">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Objectif</div>
            <p className="text-sm text-white font-medium">{session.goal_summary}</p>
          </div>
        )}

        {/* Pourquoi cette séance ? */}
        {session.strategic_context && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-brand-500/5 border border-brand-500/20 rounded-xl px-4 py-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-brand-400 text-lg">🧭</span>
              <span className="text-sm font-semibold text-brand-400">Pourquoi cette séance aujourd'hui ?</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{session.strategic_context}</p>
            {domains.length > 0 && (
              <div className="flex gap-2 flex-wrap pt-1">
                {domains.map((d) => {
                  const meta = DOMAIN_LABELS[d];
                  return meta ? (
                    <span key={d} className={`text-xs font-medium px-2 py-0.5 rounded-full bg-surface-muted ${meta.color}`}>
                      {meta.label}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Exercices par bloc */}
        {blocks.map((block) => {
          const blockExs = exercises.filter((e) => e.block === block);
          if (!blockExs.length) return null;
          return (
            <div key={block}>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                {BLOCK_LABELS[block]}
              </div>
              <div className="space-y-2">
                {blockExs.map((ex, i) => (
                  <ExerciseDetail key={ex.id ?? i} ex={ex} index={i + 1} onAlert={setAlertExercise} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Feedback */}
        {!isCompleted && !showFeedback && (
          <button onClick={() => setShowFeedback(true)}
            className="w-full py-4 bg-brand-500 rounded-2xl font-bold text-white hover:bg-brand-600 transition text-lg">
            Séance terminée ✓
          </button>
        )}

        {showFeedback && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-surface-card rounded-2xl p-5 space-y-5">
            <h3 className="font-bold text-white text-lg">Comment s'est passée la séance ?</h3>

            {/* RPE */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm text-slate-300">Effort perçu (RPE)</label>
                <span className="text-white font-bold">{rpe}/10 — {
                  rpe <= 3 ? "Très facile" : rpe <= 5 ? "Confortable" : rpe <= 7 ? "Modéré" : rpe <= 9 ? "Difficile" : "Maximum"
                }</span>
              </div>
              <input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(+e.target.value)}
                className="w-full accent-brand-500" />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Très facile</span><span>Maximum</span>
              </div>
            </div>

            {/* Énergie */}
            <div>
              <label className="text-sm text-slate-300 block mb-2">Niveau d'énergie</label>
              <div className="flex gap-2">
                {[["😴","Épuisé"],["😕","Fatigué"],["😐","Neutre"],["😊","Bien"],["🔥","En feu"]].map(([em, lab], n) => (
                  <button key={n} onClick={() => setEnergy(n + 1)}
                    className={`flex-1 py-2 rounded-xl text-xs flex flex-col items-center gap-0.5 transition ${
                      energy === n + 1 ? "bg-brand-500 text-white" : "bg-surface-muted text-slate-400 hover:bg-slate-600"
                    }`}>
                    <span className="text-lg">{em}</span>
                    <span>{lab}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Douleur */}
            <div className="flex items-center gap-3">
              <button onClick={() => setPain((p) => !p)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${pain ? "border-orange-500 bg-orange-500" : "border-surface-muted"}`}>
                {pain && <span className="text-white text-xs">✓</span>}
              </button>
              <label className="text-sm text-slate-300">Douleur ou gêne signalée</label>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm text-slate-300 block mb-1">Note (optionnel)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Exercice difficile, manque de temps, bonne séance…"
                rows={2} className="w-full bg-surface border border-surface-muted rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            </div>

            <button onClick={handleFeedback} disabled={submitting}
              className="w-full py-3 bg-brand-500 rounded-xl font-semibold text-white hover:bg-brand-600 transition disabled:opacity-50">
              {submitting ? "Enregistrement…" : "Valider mon feedback"}
            </button>
          </motion.div>
        )}
      </div>
    </div>

      <AnimatePresence>
        {alertExercise !== null && userId && (
          <HealthAlertModal
            userId={userId}
            exerciseName={alertExercise}
            onClose={() => setAlertExercise(null)}
            onSaved={() => setAlertExercise(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ExerciseDetail({ ex, index, onAlert }: { ex: any; index: number; onAlert: (name: string) => void }) {
  const [open, setOpen] = useState(index === 1);

  const prescription = [
    ex.sets && (ex.reps_min || ex.reps_max) ? `${ex.sets} séries × ${ex.reps_min ?? "?"}${ex.reps_max && ex.reps_max !== ex.reps_min ? `–${ex.reps_max}` : ""} reps` : null,
    ex.duration_sec ? `${ex.duration_sec}s` : null,
    ex.rest_sec ? `Repos : ${ex.rest_sec}s` : null,
    ex.rpe_target ? `RPE cible : ${ex.rpe_target}/10` : null,
  ].filter(Boolean);

  return (
    <div className="bg-surface-card rounded-xl overflow-hidden">
      <button className="w-full px-4 py-3 flex items-center gap-3 text-left" onClick={() => setOpen((o) => !o)}>
        <span className="text-xs text-slate-500 w-5 text-center font-mono">{index}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{ex.name_fr ?? "Exercice"}</div>
          {prescription.length > 0 && (
            <div className="text-xs text-slate-400 mt-0.5">{prescription.join(" · ")}</div>
          )}
        </div>
        {ex.demo_url && <a href={ex.demo_url} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-brand-400 hover:text-brand-300 shrink-0 px-2 py-1 bg-brand-500/10 rounded-lg">
          ▶ Démo
        </a>}
        <button
          onClick={(e) => { e.stopPropagation(); onAlert(ex.name_fr ?? ""); }}
          className="text-xs text-orange-400 hover:text-orange-300 shrink-0 px-2 py-1 bg-orange-500/10 rounded-lg"
          title="Signaler une gêne sur cet exercice"
        >
          ⚠
        </button>
        <span className="text-slate-500 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-surface-muted pt-3 space-y-3">
          {ex.load_notes && (
            <div className="text-sm text-slate-300 italic">{ex.load_notes}</div>
          )}
          {ex.cues && ex.cues.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Points clés d'exécution</div>
              <ul className="space-y-1.5">
                {ex.cues.map((cue: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-brand-400 shrink-0 font-bold">{i + 1}.</span>
                    {cue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
