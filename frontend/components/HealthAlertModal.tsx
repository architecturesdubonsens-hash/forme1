"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";

const ALERT_TYPES = [
  { value: "pain",       label: "Douleur aiguë",       icon: "⚡", desc: "Douleur franche, localisée" },
  { value: "discomfort", label: "Gêne passagère",       icon: "😬", desc: "Inconfort sans douleur nette" },
  { value: "injury",     label: "Blessure",             icon: "🩹", desc: "Traumatisme ou lésion" },
  { value: "fatigue",    label: "Fatigue excessive",    icon: "😮‍💨", desc: "Épuisement inhabituel" },
];

const BODY_ZONES = [
  "Cou / cervicales", "Épaule gauche", "Épaule droite",
  "Coude gauche", "Coude droit", "Poignet gauche", "Poignet droit",
  "Haut du dos", "Bas du dos / lombaires",
  "Abdominaux / core", "Hanche gauche", "Hanche droite",
  "Genou gauche", "Genou droit", "Cheville gauche", "Cheville droite",
  "Ischio-jambiers", "Quadriceps", "Mollets", "Pectoraux", "Général",
];

type Props = {
  userId: string;
  exerciseName?: string;   // pré-rempli si déclenché depuis un exercice
  onClose: () => void;
  onSaved: () => void;
};

export default function HealthAlertModal({ userId, exerciseName, onClose, onSaved }: Props) {
  const [type, setType]         = useState("discomfort");
  const [zone, setZone]         = useState("");
  const [severity, setSeverity] = useState(2);
  const [exercise, setExercise] = useState(exerciseName ?? "");
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("health_alerts").insert({
      user_id:       userId,
      type,
      body_zone:     zone || null,
      severity,
      exercise_name: exercise || null,
      notes:         notes || null,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 26 }}
        className="w-full max-w-lg bg-surface-card rounded-2xl p-5 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-bold text-white">Signaler une gêne</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Ces informations seront prises en compte lors de la prochaine génération de programme.
          </p>
        </div>

        {/* Type */}
        <div className="grid grid-cols-2 gap-2">
          {ALERT_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`p-3 rounded-xl border text-left transition ${
                type === t.value
                  ? "border-orange-500 bg-orange-500/10"
                  : "border-surface-muted bg-surface hover:border-slate-500"
              }`}
            >
              <div className="text-xl mb-1">{t.icon}</div>
              <div className="text-sm font-medium text-white">{t.label}</div>
              <div className="text-xs text-slate-500">{t.desc}</div>
            </button>
          ))}
        </div>

        {/* Zone corporelle */}
        <div>
          <label className="text-sm text-slate-300 block mb-2">Zone concernée</label>
          <div className="flex flex-wrap gap-1.5">
            {BODY_ZONES.map((z) => (
              <button
                key={z}
                onClick={() => setZone(zone === z ? "" : z)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                  zone === z
                    ? "bg-orange-500/20 border-orange-500 text-orange-300"
                    : "bg-surface-muted border-surface-muted text-slate-400 hover:border-slate-500"
                }`}
              >
                {z}
              </button>
            ))}
          </div>
        </div>

        {/* Intensité */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm text-slate-300">Intensité</label>
            <span className="text-sm font-bold text-white">
              {["", "Légère", "Modérée", "Significative", "Importante", "Sévère"][severity]}
            </span>
          </div>
          <input
            type="range" min={1} max={5} value={severity}
            onChange={(e) => setSeverity(+e.target.value)}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-0.5">
            <span>Légère</span><span>Sévère</span>
          </div>
        </div>

        {/* Exercice concerné */}
        <div>
          <label className="text-sm text-slate-300 block mb-1">
            Exercice concerné <span className="text-slate-500">(optionnel)</span>
          </label>
          <input
            type="text"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
            placeholder="Ex : Squat, Développé couché…"
            className="w-full bg-surface border border-surface-muted rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm text-slate-300 block mb-1">
            Précisions <span className="text-slate-500">(optionnel)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contexte, depuis quand, ce qui aggrave…"
            rows={2}
            className="w-full bg-surface border border-surface-muted rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-surface-muted text-slate-300 text-sm font-medium hover:bg-surface transition"
          >
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving || !type}
            className="flex-1 py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Signaler"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
