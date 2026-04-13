"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SnackActivity } from "./SnackCard";

interface Props {
  snack: SnackActivity;
  onClose: () => void;
}

export default function SnackPlayer({ snack, onClose }: Props) {
  const steps = snack.steps;
  const [stepIdx, setStepIdx] = useState(0);
  const [remaining, setRemaining] = useState(steps[0]?.duration_sec ?? 0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentStep = steps[stepIdx];
  const totalSec = steps.reduce((acc, s) => acc + (s.duration_sec || 0), 0);
  const elapsedSec = steps.slice(0, stepIdx).reduce((acc, s) => acc + (s.duration_sec || 0), 0) + (currentStep.duration_sec - remaining);
  const progress = totalSec > 0 ? Math.min(elapsedSec / totalSec, 1) : 0;

  // Timer
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          // Passe à l'étape suivante
          const next = stepIdx + 1;
          if (next < steps.length) {
            setStepIdx(next);
            return steps[next].duration_sec;
          } else {
            setRunning(false);
            setDone(true);
            return 0;
          }
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, stepIdx, steps]);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= steps.length) return;
    setStepIdx(idx);
    setRemaining(steps[idx].duration_sec);
  };

  const togglePlay = () => setRunning((r) => !r);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-10 pb-4">
        <button onClick={onClose} className="text-slate-400 hover:text-white transition text-lg">✕</button>
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Snack · {snack.duration_min} min</p>
          <h2 className="text-base font-bold text-white">{snack.name}</h2>
        </div>
        <span className="text-2xl">{snack.emoji}</span>
      </div>

      {/* Barre de progression globale */}
      <div className="mx-4 h-1 bg-surface-muted rounded-full overflow-hidden mb-6">
        <motion.div
          className="h-full bg-brand-500 rounded-full"
          animate={{ width: `${progress * 100}%` }}
          transition={{ ease: "linear", duration: 0.5 }}
        />
      </div>

      {/* Zone principale */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-black text-white mb-2">Bravo !</h3>
            <p className="text-slate-400">Snack terminé — {snack.duration_min} min bien investies.</p>
            <button onClick={onClose} className="mt-6 px-8 py-3 bg-brand-500 rounded-xl font-semibold text-white hover:bg-brand-600 transition">
              Fermer
            </button>
          </motion.div>
        ) : (
          <>
            {/* Numéro d'étape */}
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Étape {stepIdx + 1} / {steps.length}
            </p>

            {/* Instruction */}
            <AnimatePresence mode="wait">
              <motion.p
                key={stepIdx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="text-xl font-semibold text-white text-center leading-relaxed"
              >
                {currentStep.instruction}
              </motion.p>
            </AnimatePresence>

            {/* Timer circulaire */}
            {currentStep.duration_sec > 0 && (
              <div className="relative w-32 h-32">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#1e293b" strokeWidth="8" />
                  <motion.circle
                    cx="50" cy="50" r="44"
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    animate={{
                      strokeDashoffset: 2 * Math.PI * 44 * (1 - remaining / currentStep.duration_sec),
                    }}
                    transition={{ ease: "linear", duration: 0.5 }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-black text-white">{formatTime(remaining)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Contrôles */}
      {!done && (
        <div className="px-6 pb-10 flex items-center justify-center gap-6">
          {/* Précédent */}
          <button
            onClick={() => goTo(stepIdx - 1)}
            disabled={stepIdx === 0}
            className="w-12 h-12 rounded-full border border-surface-muted flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 transition"
          >
            ‹‹
          </button>

          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center text-2xl text-white transition shadow-lg"
          >
            {running ? "⏸" : "▶"}
          </button>

          {/* Suivant */}
          <button
            onClick={() => {
              const next = stepIdx + 1;
              if (next >= steps.length) { setDone(true); setRunning(false); }
              else goTo(next);
            }}
            className="w-12 h-12 rounded-full border border-surface-muted flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            ››
          </button>
        </div>
      )}

      {/* Liste des étapes (scroll) */}
      {!done && (
        <div className="mx-4 mb-6 bg-surface-card rounded-2xl overflow-hidden">
          <div className="max-h-36 overflow-y-auto divide-y divide-surface-muted">
            {steps.map((step, i) => (
              <button
                key={i}
                onClick={() => { goTo(i); setRunning(false); }}
                className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition ${
                  i === stepIdx ? "bg-brand-500/10" : "hover:bg-surface-muted"
                }`}
              >
                <span className={`text-xs font-bold mt-0.5 flex-shrink-0 ${i === stepIdx ? "text-brand-400" : "text-slate-600"}`}>
                  {i + 1}
                </span>
                <span className={`text-xs flex-1 leading-snug ${i < stepIdx ? "text-slate-600 line-through" : i === stepIdx ? "text-white" : "text-slate-400"}`}>
                  {step.instruction}
                </span>
                {step.duration_sec > 0 && (
                  <span className="text-xs text-slate-600 flex-shrink-0">{formatTime(step.duration_sec)}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
