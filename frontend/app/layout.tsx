import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forme 1 — Coach sportif personnalisé",
  description: "Votre programme d'entraînement intelligent, adapté à votre corps et à vos objectifs.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-surface text-white">
        {children}
      </body>
    </html>
  );
}
