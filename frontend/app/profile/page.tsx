"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);
      setLoading(false);
    };
    load();
  }, [router]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  const age = profile?.birth_year ? new Date().getFullYear() - profile.birth_year : "—";

  return (
    <div className="min-h-screen pb-24 px-4 py-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-extrabold mb-6">Profil</h1>

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
              ["Perte graisse", `${profile.goal_fat_loss}%`],
              ["Masse musculaire", `${profile.goal_muscle}%`],
              ["Mobilité", `${profile.goal_mobility}%`],
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
    </div>
  );
}
