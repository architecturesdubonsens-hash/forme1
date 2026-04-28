"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import StepObjectifs from "@/app/onboarding/steps/StepObjectifs";
import type { ProfileDraft } from "@/app/onboarding/page";

const FITNESS_LEVELS = [
  { value: "sedentary", label: "Sédentaire",  desc: "Peu ou pas d'activité" },
  { value: "light",     label: "Léger",       desc: "1–2 séances/semaine" },
  { value: "moderate",  label: "Modéré",      desc: "3–4 séances/semaine" },
  { value: "active",    label: "Actif",       desc: "5+ séances/semaine" },
  { value: "athlete",   label: "Athlète",     desc: "Entraînement quotidien" },
];

export default function ProfileEditPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const [draft, setDraft] = useState<ProfileDraft>({
    first_name: "", birth_year: 1975, gender: "male",
    weight_kg: 80, height_cm: 175, fitness_level: "light",
    goal_fat_loss: 30, goal_muscle: 30, goal_mobility: 20, goal_vo2max: 20,
    sessions_per_week: 4, session_duration_min: 60,
    equipment: [], medical_notes: "", injury_history: [],
    sport_history: [], preferred_activities: [], specific_goal: "",
    existing_training: false, existing_training_context: "",
  });

  const update = (patch: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      setUserId(user.id);
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) setDraft((d) => ({ ...d, ...data }));
      setLoading(false);
    };
    load();
  }, [router]);

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: e } = await supabase.from("profiles").upsert({ id: userId, ...draft });
    if (e) { setError(e.message); setSaving(false); return; }
    router.replace("/profile");
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen pb-12 px-4 py-8 max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white transition text-xl">←</button>
        <h1 className="text-xl font-extrabold">Modifier le profil</h1>
      </div>

      {/* Morphologie */}
      <section className="bg-surface-card rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Morphologie</h2>
        <div className="grid grid-cols-2 gap-4">
          {([
            ["Poids (kg)", "weight_kg", "number"],
            ["Taille (cm)", "height_cm", "number"],
          ] as [string, keyof ProfileDraft, string][]).map(([label, key, type]) => (
            <div key={key}>
              <label className="text-xs text-slate-400 block mb-1">{label}</label>
              <input
                type={type}
                value={draft[key] as number}
                onChange={(e) => update({ [key]: +e.target.value } as Partial<ProfileDraft>)}
                className="w-full bg-surface border border-surface-muted rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
          ))}
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-2">Niveau de forme</label>
          <div className="space-y-2">
            {FITNESS_LEVELS.map((f) => (
              <button
                key={f.value}
                onClick={() => update({ fitness_level: f.value })}
                className={`w-full p-3 rounded-xl border text-left transition flex items-center gap-3 ${
                  draft.fitness_level === f.value
                    ? "border-brand-500 bg-brand-500/10"
                    : "border-surface-muted hover:border-slate-500"
                }`}
              >
                <span className="text-sm font-medium text-white">{f.label}</span>
                <span className="text-xs text-slate-400">{f.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Objectifs */}
      <section className="bg-surface-card rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Objectifs</h2>
        <StepObjectifs draft={draft} update={update} />
      </section>

      {/* Planning */}
      <section className="bg-surface-card rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Planning</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Séances / semaine</label>
            <input type="number" min={1} max={7} value={draft.sessions_per_week}
              onChange={(e) => update({ sessions_per_week: +e.target.value })}
              className="w-full bg-surface border border-surface-muted rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Durée préférée (min)</label>
            <input type="number" min={20} max={180} step={5} value={draft.session_duration_min}
              onChange={(e) => update({ session_duration_min: +e.target.value })}
              className="w-full bg-surface border border-surface-muted rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>
      </section>

      {/* Contexte */}
      <section className="bg-surface-card rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Contexte d'entraînement</h2>
        <div className="space-y-2">
          {[
            { val: false, label: "Programme principal", desc: "Mon seul entraînement structuré" },
            { val: true,  label: "Programme complémentaire", desc: "Je pratique déjà un sport" },
          ].map((opt) => (
            <button key={String(opt.val)}
              onClick={() => update({ existing_training: opt.val })}
              className={`w-full p-3 rounded-xl border text-left transition ${
                draft.existing_training === opt.val
                  ? "border-brand-500 bg-brand-500/10"
                  : "border-surface-muted hover:border-slate-500"
              }`}>
              <div className="text-sm font-medium text-white">{opt.label}</div>
              <div className="text-xs text-slate-400">{opt.desc}</div>
            </button>
          ))}
        </div>
        {draft.existing_training && (
          <textarea value={draft.existing_training_context}
            onChange={(e) => update({ existing_training_context: e.target.value })}
            placeholder="Sport, fréquence, objectif du complément…"
            rows={3}
            className="w-full bg-surface border border-surface-muted rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
          />
        )}
      </section>

      {/* Notes médicales */}
      <section className="bg-surface-card rounded-2xl p-5 space-y-2">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Notes médicales</h2>
        <textarea value={draft.medical_notes}
          onChange={(e) => update({ medical_notes: e.target.value })}
          placeholder="Conditions médicales, contre-indications…"
          rows={3}
          className="w-full bg-surface border border-surface-muted rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
        />
      </section>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <button onClick={save} disabled={saving}
        className="w-full py-4 bg-brand-500 rounded-2xl font-bold text-white hover:bg-brand-600 transition disabled:opacity-50 text-lg">
        {saving ? "Enregistrement…" : "Sauvegarder"}
      </button>
    </div>
  );
}
