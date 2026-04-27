"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";

type Mode = "login" | "signup";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const handle = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const redirectTo = `${window.location.origin}/auth/callback`;
        const { error: e } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (e) throw e;
        setSuccess("Compte créé ! Vérifiez votre e-mail pour confirmer.");
      } else {
        const { data, error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw e;

        const user = data.user;
        if (user) {
          const { data: profile } = await supabase
            .from("profiles").select("id").eq("id", user.id).maybeSingle();
          router.replace(profile ? "/dashboard" : "/onboarding");
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inattendue.";
      setError(
        msg.includes("Invalid login") ? "Email ou mot de passe incorrect." :
        msg.includes("already registered") ? "Cet e-mail est déjà utilisé." :
        msg.includes("Password") ? "Mot de passe trop court (6 caractères min)." : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="text-brand-400">Forme</span><span className="text-white"> 1</span>
          </h1>
          <p className="text-slate-400 text-sm mt-2">Votre coach sportif intelligent</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-surface-card rounded-xl p-1 mb-6">
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                mode === m ? "bg-brand-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {m === "login" ? "Connexion" : "Créer un compte"}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">E-mail</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handle()}
                placeholder="vous@exemple.com"
                className="w-full bg-surface border border-surface-muted rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Mot de passe</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handle()}
                placeholder="••••••••"
                className="w-full bg-surface border border-surface-muted rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {error   && <p className="text-red-400 text-sm text-center">{error}</p>}
            {success && <p className="text-green-400 text-sm text-center">{success}</p>}

            <button
              onClick={handle} disabled={loading || !email || !password}
              className="w-full py-3 bg-brand-500 rounded-xl font-semibold text-white hover:bg-brand-600 transition disabled:opacity-40"
            >
              {loading ? "…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
