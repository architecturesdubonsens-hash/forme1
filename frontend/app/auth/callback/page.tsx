"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

function CallbackHandler() {
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handle = async () => {
      const supabase = createClient();

      // Supabase peut renvoyer une erreur explicite dans l'URL
      const errorParam = searchParams.get("error");
      const errorDesc  = searchParams.get("error_description");
      if (errorParam) {
        setErrorMsg(errorDesc ?? errorParam);
        setStatus("error");
        return;
      }

      const tokenHash = searchParams.get("token_hash");
      const type      = searchParams.get("type");
      const code      = searchParams.get("code");

      try {
        // Cas fréquent : Supabase a déjà vérifié le token côté serveur
        // et a redirigé ici avec la session déjà établie dans les cookies.
        // On vérifie d'abord si une session existe avant de retenter la vérification.
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // Pas encore de session — on établit nous-mêmes
          if (code) {
            // PKCE flow
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
          } else if (tokenHash && type) {
            // OTP token_hash flow
            const { error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: type as "email" | "signup" | "recovery" | "invite" | "magiclink" | "email_change",
            });
            if (error) throw error;
          } else {
            throw new Error("Lien de confirmation invalide ou expiré.");
          }
        }

        // Session établie (existante ou nouvellement créée)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Session introuvable après confirmation.");

        // Redirige selon si le profil existe
        const { data: profile } = await supabase
          .from("profiles").select("id").eq("id", user.id).maybeSingle();
        router.replace(profile ? "/dashboard" : "/onboarding");

      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erreur de confirmation.";
        setErrorMsg(
          msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("invalid")
            ? "Ce lien est expiré ou déjà utilisé. Reconnectez-vous pour en recevoir un nouveau."
            : msg
        );
        setStatus("error");
      }
    };

    handle();
  }, [router, searchParams]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Confirmation en cours…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-bold text-white">Lien invalide</h2>
        <p className="text-slate-400 text-sm">{errorMsg}</p>
        <button
          onClick={() => router.replace("/auth")}
          className="mt-4 px-6 py-3 bg-brand-500 rounded-xl font-semibold text-white hover:bg-brand-600 transition"
        >
          Retour à la connexion
        </button>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Chargement…</p>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
