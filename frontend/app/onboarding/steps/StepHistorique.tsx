import { useState } from "react";
import type { ProfileDraft } from "../page";

type Props = { draft: ProfileDraft; update: (p: Partial<ProfileDraft>) => void };

const SPORTS = [
  { value: "running",       label: "Course à pied",          icon: "🏃" },
  { value: "trail",         label: "Trail / montagne",        icon: "⛰️" },
  { value: "cycling",       label: "Cyclisme / vélo",         icon: "🚴" },
  { value: "swimming",      label: "Natation",                icon: "🏊" },
  { value: "triathlon",     label: "Triathlon",               icon: "🏅" },
  { value: "gym_fitness",   label: "Musculation / fitness",   icon: "🏋️" },
  { value: "crossfit",      label: "CrossFit / HIIT",         icon: "🔥" },
  { value: "yoga_pilates",  label: "Yoga / Pilates",          icon: "🧘" },
  { value: "martial_arts",  label: "Arts martiaux",           icon: "🥋" },
  { value: "team_sports",   label: "Sports collectifs",       icon: "⚽" },
  { value: "tennis_padel",  label: "Tennis / padel / squash", icon: "🎾" },
  { value: "hiking",        label: "Randonnée / marche nordique", icon: "🥾" },
  { value: "climbing",      label: "Escalade",                icon: "🧗" },
  { value: "skiing",        label: "Ski / snowboard",         icon: "⛷️" },
  { value: "golf",          label: "Golf",                    icon: "⛳" },
  { value: "rowing",        label: "Aviron / kayak",          icon: "🚣" },
];

const PRESET_GOALS = [
  { value: "marathon",        label: "Marathon (42 km)" },
  { value: "semi_marathon",   label: "Semi-marathon (21 km)" },
  { value: "trail_short",     label: "Trail court (< 30 km)" },
  { value: "trail_long",      label: "Trail long (> 30 km)" },
  { value: "triathlon_sprint", label: "Triathlon sprint" },
  { value: "triathlon_iron",  label: "Triathlon Ironman" },
  { value: "cyclosportive",   label: "Cyclosportive / gran fondo" },
  { value: "other",           label: "Autre objectif…" },
];

export default function StepHistorique({ draft, update }: Props) {
  const [goalPreset, setGoalPreset] = useState<string>(
    draft.specific_goal ? "other" : ""
  );

  const toggleSport = (value: string, field: "sport_history" | "preferred_activities") => {
    const current: string[] = (draft[field] as string[]) ?? [];
    const next = current.includes(value)
      ? current.filter((s) => s !== value)
      : [...current, value];
    update({ [field]: next });
  };

  const isSelected = (value: string, field: "sport_history" | "preferred_activities") =>
    ((draft[field] as string[]) ?? []).includes(value);

  const handlePreset = (value: string) => {
    setGoalPreset(value);
    if (value !== "other") {
      const label = PRESET_GOALS.find((g) => g.value === value)?.label ?? "";
      update({ specific_goal: label });
    } else {
      update({ specific_goal: "" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Historique & ambitions</h2>
        <p className="text-slate-400 text-sm">Ces informations permettent de construire un programme cohérent avec votre vécu et vos projets.</p>
      </div>

      {/* Sports pratiqués */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Sports déjà pratiqués</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {SPORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => toggleSport(s.value, "sport_history")}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-sm transition ${
                isSelected(s.value, "sport_history")
                  ? "border-brand-500 bg-brand-500/10 text-white"
                  : "border-surface-muted text-slate-400 hover:border-slate-500"
              }`}
            >
              <span>{s.icon}</span>
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Activités préférées */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Activités que vous aimez le plus</h3>
        <p className="text-xs text-slate-500 mb-2">Le programme privilégiera ces modalités quand c'est compatible.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {SPORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => toggleSport(s.value, "preferred_activities")}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-sm transition ${
                isSelected(s.value, "preferred_activities")
                  ? "border-purple-500 bg-purple-500/10 text-white"
                  : "border-surface-muted text-slate-400 hover:border-slate-500"
              }`}
            >
              <span>{s.icon}</span>
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Objectif événementiel */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Objectif événementiel <span className="text-slate-500 font-normal">(optionnel)</span></h3>
        <p className="text-xs text-slate-500 mb-2">Un événement précis à préparer ? Le coach ajustera la programmation en conséquence.</p>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {PRESET_GOALS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => handlePreset(g.value)}
              className={`px-3 py-2 rounded-xl border text-left text-sm transition ${
                goalPreset === g.value
                  ? "border-orange-500 bg-orange-500/10 text-white"
                  : "border-surface-muted text-slate-400 hover:border-slate-500"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {goalPreset && (
          <input
            type="text"
            value={draft.specific_goal ?? ""}
            onChange={(e) => update({ specific_goal: e.target.value })}
            placeholder={goalPreset === "other" ? "Ex : Ultra-trail 80 km, Compétition de judo…" : "Précisez (date, lieu…) — optionnel"}
            className="w-full bg-surface border border-surface-muted rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        )}
      </div>
    </div>
  );
}
