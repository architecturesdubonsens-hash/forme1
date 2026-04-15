"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

/**
 * Page de callback Supabase Auth.
 * Appelée après confirmation e-mail ou magic link.
 * URL : /auth/callback?token_hash=xxx&type=email
 *        ou /auth/callback?code=xxx  (PKCE flow)
 */
export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handle = async () => {
      const supabase = createClient();
      const tokenHash = searchParams.get("token_hash");
      const type      = searchParams.get("type") as "email" | "signup" | "recovery" | null;
      const code      = searchParams.get("code");

      try {
        if (tokenHash && type) {
          // Flow classique confirmation e-mail
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (error) throw error;
        } else if (code) {
          // Flow PKCE (OAuth ou magic link avec code)
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          throw new Error("Lien de confirmation invalide ou expiré.");
        }

        // Auth réussie — redirige selon si le profil existe
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles").select("id").eq("id", user.id).single();
          router.replace(profile ? "/dashboard" : "/onboarding");
        } else {
          router.replace("/auth");
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erreur de confirmation.";
        setErrorMsg(msg.includes("expired") || msg.includes("invalid")
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
