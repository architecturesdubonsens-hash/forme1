"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import StepIdentite from "./steps/StepIdentite";
import StepObjectifs from "./steps/StepObjectifs";
import StepDisponibilite from "./steps/StepDisponibilite";
import StepEquipement from "./steps/StepEquipement";
import StepSante from "./steps/StepSante";

export type ProfileDraft = {
  first_name: string;
  birth_year: number;
  gender: string;
  weight_kg: number;
  height_cm: number;
  fitness_level: string;
  goal_fat_loss: number;
  goal_muscle: number;
  goal_mobility: number;
  goal_vo2max: number;
  sessions_per_week: number;
  session_duration_min: number;
  equipment: string[];
  medical_notes: string;
  injury_history: string[];
};

const INITIAL: ProfileDraft = {
  first_name: "",
  birth_year: 1975,
  gender: "male",
  weight_kg: 80,
  height_cm: 175,
  fitness_level: "light",
  goal_fat_loss: 30,
  goal_muscle: 30,
  goal_mobility: 20,
  goal_vo2max: 20,
  sessions_per_week: 4,
  session_duration_min: 60,
  equipment: [],
  medical_notes: "",
  injury_history: [],
};

const STEPS = [
  { label: "Identité", component: StepIdentite },
  { label: "Objectifs", component: StepObjectifs },
  { label: "Disponibilité", component: StepDisponibilite },
  { label: "Équipement", component: StepEquipement },
  { label: "Santé", component: StepSante },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const update = (patch: Partial<ProfileDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authErr } = await supabase.auth.signInAnonymously();
      if (authErr || !user) throw new Error("Connexion impossible.");

      const { error: profileErr } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...draft });
      if (profileErr) throw new Error(profileErr.message);

      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  };

  const StepComponent = STEPS[step].component;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Logo / titre */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="text-brand-400">Forme</span> 1
        </h1>
        <p className="text-slate-400 text-sm mt-1">Construisons votre programme</p>
      </div>

      {/* Barre de progression */}
      <div className="w-full max-w-md mb-6">
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s.label}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? "bg-brand-500" : "bg-surface-muted"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Étape {step + 1} sur {STEPS.length} — {STEPS[step].label}
        </p>
      </div>

      {/* Carte de l'étape */}
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="bg-surface-card rounded-2xl p-6 shadow-xl"
          >
            <StepComponent draft={draft} update={update} />
          </motion.div>
        </AnimatePresence>

        {error && (
          <p className="text-red-400 text-sm text-center mt-3">{error}</p>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-4">
          {step > 0 && (
            <button
              onClick={prev}
              className="flex-1 py-3 rounded-xl border border-surface-muted text-slate-300 font-medium hover:bg-surface-card transition"
            >
              Retour
            </button>
          )}
          <button
            onClick={isLast ? submit : next}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition disabled:opacity-50"
          >
            {loading ? "Enregistrement…" : isLast ? "Lancer mon programme" : "Continuer"}
          </button>
        </div>
      </div>
    </div>
  );
}
