import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'CapInSitu — Génération architecturale IA',
  description: 'Génération de bâtiments depuis cahier des charges via IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex">
        <Nav />
        <main className="flex-1 ml-16 md:ml-56 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
