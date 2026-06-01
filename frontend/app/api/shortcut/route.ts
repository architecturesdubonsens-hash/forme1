import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// ── Helpers XML plist ─────────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stableUuid(userId: string, key: string): string {
  const h = crypto.createHash("md5").update(`${userId}-${key}`).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`.toUpperCase();
}

function textVal(text: string): string {
  return `<dict><key>Value</key><string>${esc(text)}</string><key>WFSerializationType</key><string>WFTextTokenString</string></dict>`;
}

function outputRef(uuid: string, name: string): string {
  return `<dict><key>Value</key><dict><key>Type</key><string>ActionOutput</string><key>OutputUUID</key><string>${uuid}</string><key>OutputName</key><string>${esc(name)}</string></dict><key>WFSerializationType</key><string>WFTextTokenAttachment</string></dict>`;
}

function dictItem(key: string, value: string, type = 0): string {
  return `<dict><key>WFItemType</key><integer>${type}</integer><key>WFKey</key>${textVal(key)}<key>WFValue</key>${value}</dict>`;
}

function wfDict(items: string[]): string {
  return `<dict><key>Value</key><dict><key>WFDictionaryFieldValueItems</key><array>${items.join("")}</array></dict><key>WFSerializationType</key><string>WFDictionaryFieldValue</string></dict>`;
}

function quantityRead(uid: string, hkType: string, outputName: string, mode = "From"): string {
  const extra = mode === "From"
    ? `<key>WFHealthDateUnitKey</key><string>Days</string><key>WFHealthStartDate</key><integer>-1</integer>`
    : "";
  return `<dict>
    <key>WFWorkflowActionIdentifier</key><string>is.workflow.actions.health.quantity.read</string>
    <key>WFWorkflowActionParameters</key><dict>
      <key>WFHealthQuantityTypeKey</key><string>${hkType}</string>
      <key>WFHealthDateRangePickerMode</key><string>${mode}</string>
      ${extra}
      <key>CustomOutputName</key><string>${esc(outputName)}</string>
      <key>UUID</key><string>${uid}</string>
    </dict>
  </dict>`;
}

function firstItem(uid: string, inputUuid: string, inputName: string, outputName: string): string {
  return `<dict>
    <key>WFWorkflowActionIdentifier</key><string>is.workflow.actions.getitemfromlist</string>
    <key>WFWorkflowActionParameters</key><dict>
      <key>WFItemIndex</key><integer>1</integer>
      <key>WFInput</key>${outputRef(inputUuid, inputName)}
      <key>CustomOutputName</key><string>${esc(outputName)}</string>
      <key>UUID</key><string>${uid}</string>
    </dict>
  </dict>`;
}

// ── Générateur principal ──────────────────────────────────────────────────────

function generatePlist(userId: string, backendUrl: string): string {
  const u: Record<string, string> = {};
  for (const k of ["rhr","hrv","cals","date","datefmt","rhr_v","hrv_v","cals_v","req","notif"]) {
    u[k] = stableUuid(userId, k);
  }

  const syncUrl = esc(backendUrl.replace(/\/$/, "") + "/api/wearable/sync");

  const actions = [
    quantityRead(u.rhr,  "HKQuantityTypeIdentifierRestingHeartRate",        "FC Repos"),
    quantityRead(u.hrv,  "HKQuantityTypeIdentifierHeartRateVariabilitySDNN", "HRV"),
    quantityRead(u.cals, "HKQuantityTypeIdentifierActiveEnergyBurned",       "Calories", "Yesterday"),

    // Date du jour
    `<dict>
      <key>WFWorkflowActionIdentifier</key><string>is.workflow.actions.date</string>
      <key>WFWorkflowActionParameters</key><dict>
        <key>CustomOutputName</key><string>Date Brute</string>
        <key>UUID</key><string>${u.date}</string>
      </dict>
    </dict>`,

    // Format YYYY-MM-DD
    `<dict>
      <key>WFWorkflowActionIdentifier</key><string>is.workflow.actions.format.date</string>
      <key>WFWorkflowActionParameters</key><dict>
        <key>WFDateFormatStyle</key><string>Custom</string>
        <key>WFDateFormat</key><string>yyyy-MM-dd</string>
        <key>WFInput</key>${outputRef(u.date, "Date Brute")}
        <key>CustomOutputName</key><string>Date</string>
        <key>UUID</key><string>${u.datefmt}</string>
      </dict>
    </dict>`,

    firstItem(u.rhr_v,  u.rhr,  "FC Repos",  "FC Valeur"),
    firstItem(u.hrv_v,  u.hrv,  "HRV",       "HRV Valeur"),
    firstItem(u.cals_v, u.cals, "Calories",  "Calories Valeur"),

    // Requête POST
    `<dict>
      <key>WFWorkflowActionIdentifier</key><string>is.workflow.actions.downloadurl</string>
      <key>WFWorkflowActionParameters</key><dict>
        <key>WFURL</key><string>${syncUrl}</string>
        <key>WFHTTPMethod</key><string>POST</string>
        <key>WFHTTPBodyType</key><string>JSON</string>
        <key>WFHTTPRequestHeaders</key>${wfDict([
          dictItem("Content-Type", textVal("application/json")),
          dictItem("x-user-id",    textVal(userId)),
        ])}
        <key>WFFormValues</key>${wfDict([
          dictItem("date",            outputRef(u.datefmt, "Date"),           0),
          dictItem("resting_hr",      outputRef(u.rhr_v,  "FC Valeur"),       3),
          dictItem("hrv_rmssd",       outputRef(u.hrv_v,  "HRV Valeur"),      3),
          dictItem("active_calories", outputRef(u.cals_v, "Calories Valeur"), 3),
        ])}
        <key>UUID</key><string>${u.req}</string>
      </dict>
    </dict>`,

    // Notification
    `<dict>
      <key>WFWorkflowActionIdentifier</key><string>is.workflow.actions.notification.show</string>
      <key>WFWorkflowActionParameters</key><dict>
        <key>WFNotificationActionTitle</key><string>Forme 1</string>
        <key>WFInput</key>${textVal("Apple Watch synchronisée ✓")}
        <key>UUID</key><string>${u.notif}</string>
      </dict>
    </dict>`,
  ].join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>WFWorkflowActions</key><array>${actions}</array>
  <key>WFWorkflowClientVersion</key><string>1300.0.0</string>
  <key>WFWorkflowHasShortcutInputVariables</key><false/>
  <key>WFWorkflowImportQuestions</key><array/>
  <key>WFWorkflowInputContentItemClasses</key><array/>
  <key>WFWorkflowMinimumClientVersion</key><integer>900</integer>
  <key>WFWorkflowName</key><string>Forme 1 — Sync Apple Watch</string>
  <key>WFWorkflowTypes</key><array/>
</dict>
</plist>`;
}

// ── Route GET /api/shortcut ───────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId    = searchParams.get("user_id") ?? "";
  const backendUrl = searchParams.get("backend_url")
    ?? process.env.NEXT_PUBLIC_API_URL
    ?? "";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return new NextResponse("UUID invalide", { status: 400 });
  }
  if (!backendUrl) {
    return new NextResponse("backend_url manquant", { status: 400 });
  }

  const xml = generatePlist(userId, backendUrl);

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/x-apple-shortcuts",
      "Content-Disposition": 'attachment; filename="Forme1-AppleWatch.shortcut"',
      "Cache-Control": "no-store",
    },
  });
}
