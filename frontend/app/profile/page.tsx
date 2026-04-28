"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import HealthAlertModal from "@/components/HealthAlertModal";

const TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  pain:       { label: "Douleur aiguë",    color: "text-red-400 bg-red-500/10 border-red-500/30",     icon: "⚡" },
  discomfort: { label: "Gêne passagère",   color: "text-orange-400 bg-orange-500/10 border-orange-500/30", icon: "😬" },
  injury:     { label: "Blessure",         color: "text-red-400 bg-red-500/10 border-red-500/30",     icon: "🩹" },
  fatigue:    { label: "Fatigue excessive",color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", icon: "😮‍💨" },
};

export default function ProfilePage() {
  const [profile, setProfile]         = useState<any>(null);
  const [userId, setUserId]           = useState<string | null>(null);
  const [alerts, setAlerts]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showAlert, setShowAlert]     = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const router = useRouter();

  const load = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/auth"); return; }
    setUserId(user.id);

    const [{ data: p }, { data: a }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("health_alerts").select("*").eq("user_id", user.id)
        .eq("resolved", false).order("created_at", { ascending: false }).limit(10),
    ]);
    setProfile(p);
    setAlerts(a ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [router]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  const resolveAlert = async (id: string) => {
    const supabase = createClient();
    await supabase.from("health_alerts").update({ resolved: true, resolved_at: new Date().toISOString() }).eq("id", id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const age = profile?.birth_year ? new Date().getFullYear() - profile.birth_year : "—";
  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, 3);

  return (
    <div className="min-h-screen pb-24 px-4 py-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">Profil</h1>
        <button
          onClick={() => router.push("/profile/edit")}
          className="px-4 py-2 rounded-xl border border-brand-500/50 text-brand-400 text-sm font-medium hover:bg-brand-500/10 transition"
        >
          Modifier
        </button>
      </div>

      {/* Alertes santé actives */}
      {alerts.length > 0 && (
        <div className="mb-5 bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
              ⚠ Gênes actives ({alerts.length})
            </h2>
            {alerts.length > 3 && (
              <button onClick={() => setShowAllAlerts((v) => !v)}
                className="text-xs text-slate-400 hover:text-slate-200">
                {showAllAlerts ? "Réduire" : "Tout voir"}
              </button>
            )}
          </div>
          {visibleAlerts.map((alert) => {
            const meta = TYPE_LABELS[alert.type] ?? TYPE_LABELS.discomfort;
            return (
              <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-xl border ${meta.color}`}>
                <span className="text-lg shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{meta.label}</div>
                  {alert.body_zone && <div className="text-xs opacity-75">{alert.body_zone}</div>}
                  {alert.exercise_name && <div className="text-xs opacity-75">Exercice : {alert.exercise_name}</div>}
                  {alert.notes && <div className="text-xs opacity-60 mt-0.5">{alert.notes}</div>}
                  <div className="text-xs opacity-50 mt-1">
                    {new Date(alert.created_at).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                <button onClick={() => resolveAlert(alert.id)}
                  className="text-xs opacity-60 hover:opacity-100 transition shrink-0 px-2 py-1 rounded-lg hover:bg-black/20">
                  Résolu ✓
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Bouton signaler */}
      <button
        onClick={() => setShowAlert(true)}
        className="w-full mb-5 py-3 rounded-xl border border-orange-500/30 text-orange-400 text-sm font-medium hover:bg-orange-500/5 transition flex items-center justify-center gap-2"
      >
        ⚠ Signaler une douleur ou une gêne
      </button>

      {profile && (
        <div className="space-y-3">
          <div className="bg-surface-card rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Identité</h2>
            {[
              ["Prénom", profile.first_name ?? "—"],
              ["Âge", `${age} ans`],
              ["Poids", profile.weight_kg ? `${profile.weight_kg} kg` : "—"],
              ["Taille", profile.height_cm ? `${profile.height_cm} cm` : "—"],
              ["Niveau", profile.fitness_level ?? "—"],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between text-sm">
                <span className="text-slate-400">{l}</span>
                <span className="text-white font-medium">{v}</span>
              </div>
            ))}
          </div>

          <div className="bg-surface-card rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Objectifs</h2>
            {[
              ["Perte de graisse", `${profile.goal_fat_loss}%`],
              ["Masse musculaire", `${profile.goal_muscle}%`],
              ["Mobilité & proprioception", `${profile.goal_mobility}%`],
              ["VO2max", `${profile.goal_vo2max}%`],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between text-sm">
                <span className="text-slate-400">{l}</span>
                <span className="text-white font-medium">{v}</span>
              </div>
            ))}
          </div>

          <div className="bg-surface-card rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Planning</h2>
            {[
              ["Séances/semaine", profile.sessions_per_week],
              ["Durée préférée", `${profile.session_duration_min} min`],
            ].map(([l, v]) => (
              <div key={l as string} className="flex justify-between text-sm">
                <span className="text-slate-400">{l}</span>
                <span className="text-white font-medium">{v}</span>
              </div>
            ))}
          </div>

          {profile.existing_training && profile.existing_training_context && (
            <div className="bg-surface-card rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Pratique existante</h2>
              <p className="text-sm text-slate-300">{profile.existing_training_context}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 space-y-3">
        <button onClick={() => router.push("/onboarding/assessment")}
          className="w-full py-3 border border-surface-muted rounded-xl text-slate-300 text-sm font-medium hover:bg-surface-card transition">
          Refaire les tests d'évaluation
        </button>
        <button onClick={signOut}
          className="w-full py-3 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium hover:bg-red-500/5 transition">
          Se déconnecter
        </button>
      </div>

      <BottomNav active="profile" />

      <AnimatePresence>
        {showAlert && userId && (
          <HealthAlertModal
            userId={userId}
            onClose={() => setShowAlert(false)}
            onSaved={() => { setShowAlert(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
