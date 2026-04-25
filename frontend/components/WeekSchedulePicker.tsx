"use client";
import { useState } from "react";
import { motion } from "framer-motion";

export type DayType = "free" | "office" | "travel" | "hotel" | "busy" | "long_session";

export type DaySchedule = {
  day: number;   // 0=lun … 6=dim
  date: string;  // "2026-04-14"
  type: DayType;
};

const DAY_TYPES: { value: DayType; icon: string; label: string; desc: string }[] = [
  { value: "free",         icon: "🏠", label: "Libre",        desc: "Disponible pour séance" },
  { value: "long_session", icon: "🎯", label: "Séance longue", desc: "Temps pour +90 min" },
  { value: "office",       icon: "💼", label: "Bureau",        desc: "Journée sédentaire" },
  { value: "busy",         icon: "📅", label: "Chargée",       desc: "Peu de temps" },
  { value: "travel",       icon: "✈️", label: "Voyage",        desc: "En déplacement" },
  { value: "hotel",        icon: "🏨", label: "Hôtel",         desc: "Nuit à l'hôtel" },
];

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const CHECKIN_CHIPS = [
  { id: "same",       label: "Objectifs identiques" },
  { id: "objectives", label: "Objectifs mis à jour" },
  { id: "activities", label: "Nouvelles activités" },
  { id: "injury",     label: "Blessure / contrainte" },
];

type Props = {
  weekStart: Date;
  showCheckin?: boolean;
  onConfirm: (schedule: DaySchedule[], weekContext: string) => void;
  onCancel: () => void;
};

function buildInitialSchedule(weekStart: Date): DaySchedule[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dow = d.getDay(); // 0=dim … 6=sam
    // Défaut : lun-ven = bureau, sam-dim = libre
    const defaultType: DayType = dow === 0 || dow === 6 ? "free" : "office";
    return {
      day: i,
      date: d.toISOString().split("T")[0],
      type: defaultType,
    };
  });
}

export default function WeekSchedulePicker({ weekStart, showCheckin, onConfirm, onCancel }: Props) {
  const [step, setStep] = useState<"checkin" | "schedule">(showCheckin ? "checkin" : "schedule");
  const [checkedChips, setCheckedChips] = useState<Set<string>>(new Set(["same"]));
  const [checkinNote, setCheckinNote] = useState("");
  const [schedule, setSchedule] = useState<DaySchedule[]>(buildInitialSchedule(weekStart));

  const toggleChip = (id: string) => {
    setCheckedChips((prev) => {
      const next = new Set(prev);
      if (id === "same") {
        return new Set(["same"]);
      }
      next.delete("same");
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) next.add("same");
      return next;
    });
  };

  const buildWeekContext = () => {
    const chips = CHECKIN_CHIPS.filter((c) => checkedChips.has(c.id) && c.id !== "same").map((c) => c.label);
    const parts = [];
    if (chips.length > 0) parts.push(`Changements signalés : ${chips.join(", ")}.`);
    if (checkinNote.trim()) parts.push(checkinNote.trim());
    return parts.join(" ");
  };

  const cycleType = (dayIndex: number) => {
    setSchedule((prev) =>
      prev.map((d) => {
        if (d.day !== dayIndex) return d;
        const idx = DAY_TYPES.findIndex((t) => t.value === d.type);
        const next = DAY_TYPES[(idx + 1) % DAY_TYPES.length];
        return { ...d, type: next.value };
      })
    );
  };

  const setType = (dayIndex: number, type: DayType) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day === dayIndex ? { ...d, type } : d))
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25 }}
        className="w-full max-w-lg bg-surface-card rounded-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Étape 0 : check-in hebdomadaire */}
        {step === "checkin" && (
          <>
            <div>
              <h2 className="text-lg font-bold text-white">Bilan de la semaine</h2>
              <p className="text-slate-400 text-sm mt-0.5">
                Des évolutions depuis la dernière génération ?
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {CHECKIN_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => toggleChip(chip.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition border ${
                    checkedChips.has(chip.id)
                      ? "bg-brand-500/20 border-brand-500 text-brand-300"
                      : "bg-surface-muted border-surface-muted text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {!checkedChips.has("same") && (
              <textarea
                value={checkinNote}
                onChange={(e) => setCheckinNote(e.target.value)}
                placeholder="Précisez si besoin (ex : reprise du tennis, douleur genou gauche…)"
                className="w-full bg-surface-muted border border-surface-muted rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
                rows={3}
              />
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl border border-surface-muted text-slate-300 text-sm font-medium hover:bg-surface transition"
              >
                Annuler
              </button>
              <button
                onClick={() => setStep("schedule")}
                className="flex-1 py-3 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition"
              >
                Suivant →
              </button>
            </div>
          </>
        )}

        {/* Étape 1 : planning de semaine */}
        {step === "schedule" && (<>
        <div>
          <h2 className="text-lg font-bold text-white">Votre semaine</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Indiquez vos contraintes — le coach adaptera le programme en conséquence.
          </p>
        </div>

        {/* Légende rapide */}
        <div className="flex flex-wrap gap-2">
          {DAY_TYPES.map((t) => (
            <span key={t.value} className="text-xs text-slate-500 flex items-center gap-1">
              {t.icon} {t.label}
            </span>
          ))}
        </div>

        {/* 7 jours */}
        <div className="space-y-2">
          {schedule.map((d) => {
            const current = DAY_TYPES.find((t) => t.value === d.type)!;
            const dateObj = new Date(d.date + "T12:00:00");
            return (
              <div key={d.day} className="flex items-center gap-3">
                {/* Jour + date */}
                <div className="w-16 shrink-0">
                  <div className="text-sm font-semibold text-white">{DAYS_FR[d.day]}</div>
                  <div className="text-xs text-slate-500">
                    {dateObj.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </div>
                </div>

                {/* Sélecteur type — mini pills horizontales */}
                <div className="flex gap-1 flex-wrap">
                  {DAY_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setType(d.day, t.value)}
                      className={`text-lg leading-none p-1.5 rounded-lg transition ${
                        d.type === t.value
                          ? "bg-brand-500/30 ring-1 ring-brand-500"
                          : "bg-surface-muted opacity-40 hover:opacity-70"
                      }`}
                      title={t.label}
                    >
                      {t.icon}
                    </button>
                  ))}
                </div>

                {/* Label courant */}
                <span className="text-xs text-slate-400 ml-auto shrink-0">
                  {current.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-surface-muted text-slate-300 text-sm font-medium hover:bg-surface transition"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(schedule, buildWeekContext())}
            className="flex-1 py-3 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition"
          >
            Générer mon programme
          </button>
        </div>
        </>)}
      </motion.div>
    </motion.div>
  );
}
