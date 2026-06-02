import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function generateScriptableJs(userId: string, backendUrl: string): string {
  return `// Forme 1 — Sync Apple Watch via Scriptable
// ─────────────────────────────────────────────
// INSTALLATION :
//   1. Installe Scriptable depuis l'App Store
//   2. Crée un nouveau script, colle ce code, nomme-le "Forme1 Sync"
//   3. Dans Raccourcis, crée une automatisation à 7h00 avec :
//      - Actions Santé : FC repos, HRV, Énergie active (hier)
//      - Action "Exécuter le script Scriptable" → Forme1 Sync
//        Passer en entrée : un dictionnaire JSON avec resting_hr, hrv_rmssd, active_calories
// ─────────────────────────────────────────────

const USER_ID    = "${userId}";
const BACKEND    = "${backendUrl.replace(/\/$/, "")}";

// Données passées par Raccourcis (optionnel — marche aussi en saisie manuelle)
let health = {};
try {
  const raw = args.shortcutParameter;
  if (raw) health = typeof raw === "string" ? JSON.parse(raw) : raw;
} catch (_) {}

health.date = new Date().toISOString().split("T")[0];

// Si lancé manuellement sans Raccourcis, demander les valeurs
if (!health.resting_hr) {
  const fc  = await presentAlert("FC repos (bpm) ?", ["Annuler"], true);
  const hrv = await presentAlert("HRV RMSSD (ms) ?", ["Annuler"], true);
  if (fc  !== null) health.resting_hr = parseInt(fc);
  if (hrv !== null) health.hrv_rmssd  = parseFloat(hrv);
}

// POST vers le backend Forme 1
const req    = new Request(\`\${BACKEND}/api/wearable/sync\`);
req.method   = "POST";
req.headers  = { "Content-Type": "application/json", "x-user-id": USER_ID };
req.body     = JSON.stringify(health);

try {
  const resp  = await req.loadJSON();
  const score = resp.recovery_score ?? "—";

  const notif  = new Notification();
  notif.title  = "Forme 1 ✓";
  notif.body   = \`Score de récupération : \${score}/100\`;
  await notif.schedule();

  Script.setShortcutOutput(String(score));
} catch (e) {
  const notif  = new Notification();
  notif.title  = "Forme 1 — Erreur";
  notif.body   = String(e);
  await notif.schedule();
  Script.setShortcutOutput("erreur");
}

Script.complete();

// ── Helper ──────────────────────────────────────────────────────────────────
async function presentAlert(message, options, input) {
  const alert = new Alert();
  alert.message = message;
  if (input) alert.addTextField("", "");
  options.forEach(o => alert.addAction(o));
  alert.addCancelAction("Passer");
  const idx = await alert.presentAlert();
  if (idx === -1) return null;
  return input ? alert.textFieldValue(0) : options[idx];
}
`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId     = searchParams.get("user_id") ?? "";
  const backendUrl = searchParams.get("backend_url")
    ?? process.env.NEXT_PUBLIC_API_URL
    ?? "";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return new NextResponse("UUID invalide", { status: 400 });
  }

  const js = generateScriptableJs(userId, backendUrl);

  return new NextResponse(js, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="Forme1-Sync.js"',
      "Cache-Control": "no-store",
    },
  });
}
