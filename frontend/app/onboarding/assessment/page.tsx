"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";

type TestState = "idle" | "countdown" | "running" | "done";

type Results = {
  squat_30s_reps:   number | null;
  pushup_max:       number | null;
  six_min_walk_m:   number | null;
  sit_reach_cm:     number | null;
};

const EMPTY: Results = { squat_30s_reps: null, pushup_max: null, six_min_walk_m: null, sit_reach_cm: null };

export default function AssessmentPage() {
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<Results>(EMPTY);
  const [timerState, setTimerState] = useState<TestState>("idle");
  const [timeLeft, setTimeLeft] = useState(0);
  const [counter, setCounter] = useState(0);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const tests = [
    {
      key: "squat_30s_reps" as keyof Results,
      title: "Test squat 30 secondes",
      icon: "🦵",
      desc: "Comptez le nombre de squats complets en 30 secondes. Pieds écartés à largeur d'épaules, descendre jusqu'à ce que les cuisses soient parallèles au sol.",
      type: "timed",
      duration: 30,
      unit: "squats",
      inputLabel: "Nombre de squats réalisés",
      tip: "Restez debout entre les séries. Comptez uniquement les répétitions complètes.",
    },
    {
      key: "pushup_max" as keyof Results,
      title: "Pompes maximum",
      icon: "💪",
      desc: "Réalisez le maximum de pompes sans pause, corps gainé, coudes à 45°. Arrêtez au premier défaut de forme.",
      type: "counter",
      unit: "pompes",
      inputLabel: "Nombre de pompes réalisées",
      tip: "Genoux au sol si nécessaire — c'est une variante valide.",
    },
    {
      key: "six_min_walk_m" as keyof Results,
      title: "Test de marche 6 minutes",
      icon: "🚶",
      desc: "Marchez le plus loin possible en 6 minutes à votre meilleur rythme. Pas de course. Mesurez ensuite la distance parcourue.",
      type: "timed",
      duration: 360,
      unit: "mètres",
      inputLabel: "Distance parcourue (mètres)",
      tip: "Idéalement sur un terrain plat. Vous pouvez réduire l'allure si nécessaire mais ne vous arrêtez pas.",
    },
    {
      key: "sit_reach_cm" as keyof Results,
      title: "Souplesse — test assis/atteinte",
      icon: "🧘",
      desc: "Assis au sol, jambes tendues, inclinez-vous vers l'avant le plus loin possible. Mesurez la distance entre vos doigts et la pointe des pieds.",
      type: "manual",
      unit: "cm",
      inputLabel: "Distance (cm) — positif si au-delà des pieds, négatif sinon",
      tip: "0 cm = bout des doigts aux pieds. +5 = 5 cm au-delà. -5 = 5 cm avant les pieds.",
    },
  ];

  const test = tests[step];
  const isDone = step >= tests.length;

  // Timer
  const startTimer = (duration: number) => {
    setTimeLeft(duration);
    setTimerState("countdown");
    let count = 3;
    setCounter(count);
    const cdInterval = setInterval(() => {
      count--;
      setCounter(count);
      if (count === 0) {
        clearInterval(cdInterval);
        setTimerState("running");
        let remaining = duration;
        const runInterval = setInterval(() => {
          remaining--;
          setTimeLeft(remaining);
          if (remaining <= 0) {
            clearInterval(runInterval);
            setTimerState("done");
          }
        }, 1000);
      }
    }, 1000);
  };

  const setResult = (key: keyof Results, val: string) => {
    const n = parseFloat(val);
    setResults((r) => ({ ...r, [key]: isNaN(n) ? null : n }));
  };

  const saveAndFinish = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth"); return; }

    await supabase.from("fitness_assessments").insert({
      user_id: user.id,
      squat_30s_reps:  results.squat_30s_reps,
      pushup_max:       results.pushup_max,
      six_min_walk_m:   results.six_min_walk_m,
      sit_reach_cm:     results.sit_reach_cm,
    });
    router.push("/dashboard");
  };

  if (isDone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-bold">Tests terminés !</h2>
          <p className="text-slate-400 text-sm">Vos résultats servent de référence. On les comparera dans 4–6 semaines.</p>
          <div className="bg-surface-card rounded-2xl p-4 text-left space-y-2 text-sm">
            {tests.map((t) => {
              const val = results[t.key];
              return (
                <div key={t.key} className="flex justify-between">
                  <span className="text-slate-400">{t.title}</span>
                  <span className="text-white font-medium">{val != null ? `${val} ${t.unit}` : "—"}</span>
                </div>
              );
            })}
          </div>
          <button onClick={saveAndFinish} disabled={saving}
            className="w-full py-3 bg-brand-500 rounded-xl font-semibold text-white hover:bg-brand-600 transition disabled:opacity-50">
            {saving ? "Enregistrement…" : "Lancer mon programme"}
          </button>
          <button onClick={() => router.push("/dashboard")} className="w-full text-sm text-slate-500 hover:text-slate-400">
            Passer pour l'instant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Progression — étape 6/6 dans le flux onboarding */}
        <div className="mb-4">
          <div className="flex gap-1.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-full bg-brand-500" />
            ))}
            <div className="h-1 flex-1 rounded-full bg-brand-500" />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Étape 6 sur 6 — Évaluation physique ({step + 1}/{tests.length})
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}
            className="space-y-5">
            {/* En-tête */}
            <div>
              <div className="text-4xl mb-2">{test.icon}</div>
              <h2 className="text-xl font-bold">{test.title}</h2>
              <p className="text-slate-400 text-sm mt-1">{test.desc}</p>
            </div>

            {/* Conseil */}
            <div className="bg-surface-card border border-surface-muted rounded-xl px-4 py-3 text-sm text-slate-400">
              <span className="text-brand-400">💡 </span>{test.tip}
            </div>

            {/* Timer (tests chronométrés) */}
            {test.type === "timed" && (
              <div className="text-center">
                {timerState === "idle" && (
                  <button onClick={() => startTimer(test.duration!)}
                    className="w-full py-3 bg-brand-500 rounded-xl font-semibold text-white hover:bg-brand-600 transition">
                    Démarrer le chrono
                  </button>
                )}
                {timerState === "countdown" && (
                  <div className="text-7xl font-black text-brand-400">{counter}</div>
                )}
                {timerState === "running" && (
                  <div>
                    <div className="text-7xl font-black text-white tabular-nums">
                      {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
                    </div>
                    <p className="text-slate-400 text-sm mt-2">
                      {test.key === "squat_30s_reps" ? "Squatez !" : "Marchez !"}
                    </p>
                  </div>
                )}
                {timerState === "done" && (
                  <div className="text-brand-400 text-lg font-bold">Temps écoulé !</div>
                )}
              </div>
            )}

            {/* Saisie du résultat */}
            {(timerState === "done" || test.type === "counter" || test.type === "manual") && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{test.inputLabel}</label>
                <input type="number"
                  value={results[test.key] ?? ""}
                  onChange={(e) => setResult(test.key, e.target.value)}
                  placeholder="0"
                  className="w-full bg-surface border border-surface-muted rounded-xl px-4 py-3 text-white text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
              {step > 0 && (
                <button onClick={() => { setStep((s) => s - 1); setTimerState("idle"); }}
                  className="flex-1 py-3 rounded-xl border border-surface-muted text-slate-300 hover:bg-surface-card transition">
                  Retour
                </button>
              )}
              <button
                onClick={() => { setStep((s) => s + 1); setTimerState("idle"); }}
                disabled={test.type === "timed" && timerState !== "done" && results[test.key] == null}
                className="flex-1 py-3 bg-brand-500 rounded-xl font-semibold text-white hover:bg-brand-600 transition disabled:opacity-50">
                {step < tests.length - 1 ? "Test suivant" : "Voir mes résultats"}
              </button>
            </div>
            <button onClick={() => { setResults((r) => ({ ...r, [test.key]: null })); setStep((s) => s + 1); setTimerState("idle"); }}
              className="w-full text-xs text-slate-500 hover:text-slate-400 transition">
              Passer ce test
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
