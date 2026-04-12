import type { ProfileDraft } from "../page";

type Props = { draft: ProfileDraft; update: (p: Partial<ProfileDraft>) => void };

const EQUIPMENT = [
  { value: "none",             label: "Aucun",              icon: "🙌", desc: "Poids de corps uniquement" },
  { value: "dumbbells",        label: "Haltères",           icon: "🏋️", desc: "Paire réglable ou fixe" },
  { value: "barbell",          label: "Barre + disques",    icon: "⚖️", desc: "Barre olympique" },
  { value: "kettlebell",       label: "Kettlebell",         icon: "🔔", desc: "Un ou plusieurs" },
  { value: "pull_up_bar",      label: "Barre de traction",  icon: "🪝", desc: "Fixe ou de porte" },
  { value: "resistance_bands", label: "Élastiques",         icon: "📎", desc: "Bandes de résistance" },
  { value: "bench",            label: "Banc de musculation",icon: "🪑", desc: "Plat ou inclinable" },
  { value: "gym_full",         label: "Salle complète",     icon: "🏢", desc: "Accès à une salle équipée" },
  { value: "pool",             label: "Piscine",            icon: "🏊", desc: "Natation disponible" },
  { value: "bike",             label: "Vélo",               icon: "🚴", desc: "Vélo de route ou home trainer" },
  { value: "treadmill",        label: "Tapis de course",    icon: "🏃", desc: "Tapis ou accès extérieur" },
];

export default function StepEquipement({ draft, update }: Props) {
  const toggle = (value: string) => {
    const current = draft.equipment;
    if (value === "none") {
      update({ equipment: ["none"] });
      return;
    }
    const withoutNone = current.filter((e) => e !== "none");
    const next = withoutNone.includes(value)
      ? withoutNone.filter((e) => e !== value)
      : [...withoutNone, value];
    update({ equipment: next.length === 0 ? ["none"] : next });
  };

  const isSelected = (value: string) => draft.equipment.includes(value);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Votre équipement</h2>
        <p className="text-slate-400 text-sm">Sélectionnez tout ce dont vous disposez. Le programme s'y adapte.</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {EQUIPMENT.map((eq) => (
          <button
            key={eq.value}
            type="button"
            onClick={() => toggle(eq.value)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition ${
              isSelected(eq.value)
                ? "border-brand-500 bg-brand-500/10"
                : "border-surface-muted hover:border-slate-500"
            }`}
          >
            <span className="text-xl w-7">{eq.icon}</span>
            <div>
              <span className={`text-sm font-medium block ${isSelected(eq.value) ? "text-white" : "text-slate-300"}`}>
                {eq.label}
              </span>
              <span className="text-xs text-slate-500">{eq.desc}</span>
            </div>
            {isSelected(eq.value) && (
              <span className="ml-auto text-brand-400 text-lg">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
