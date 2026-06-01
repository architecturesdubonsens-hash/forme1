"""
Génère un fichier .shortcut (plist binaire Apple) prêt à importer dans
l'app Raccourcis iOS, avec l'UUID utilisateur et l'URL du backend pré-remplis.

Le Raccourci synchronise chaque matin :
  - FC repos (HKQuantityTypeIdentifierRestingHeartRate)
  - HRV RMSSD (HKQuantityTypeIdentifierHeartRateVariabilitySDNN)
  - Calories actives de la veille (HKQuantityTypeIdentifierActiveEnergyBurned)

Le sommeil est exclu car HealthKit l'expose comme catégorie (pas une quantité),
ce qui nécessiterait plusieurs actions de calcul supplémentaires.
L'utilisateur peut saisir le sommeil manuellement via l'app.
"""
import hashlib
import plistlib
import uuid as _uuid
from io import BytesIO


def _text_val(text: str) -> dict:
    return {"Value": text, "WFSerializationType": "WFTextTokenString"}


def _output_ref(action_uuid: str, output_name: str) -> dict:
    return {
        "Value": {
            "Type": "ActionOutput",
            "OutputUUID": action_uuid,
            "OutputName": output_name,
        },
        "WFSerializationType": "WFTextTokenAttachment",
    }


def _dict_field(key: str, value: dict, item_type: int = 0) -> dict:
    return {"WFItemType": item_type, "WFKey": _text_val(key), "WFValue": value}


def _wf_dict(items: list[dict]) -> dict:
    return {
        "Value": {"WFDictionaryFieldValueItems": items},
        "WFSerializationType": "WFDictionaryFieldValue",
    }


def _stable_uuid(user_id: str, key: str) -> str:
    """UUID déterministe : re-télécharger le fichier donne le même raccourci."""
    h = hashlib.md5(f"{user_id}-{key}".encode()).hexdigest()
    return str(_uuid.UUID(h)).upper()


def generate_shortcut_plist(user_id: str, backend_url: str) -> bytes:
    u = {k: _stable_uuid(user_id, k) for k in [
        "rhr", "hrv", "cals", "date", "datefmt",
        "rhr_val", "hrv_val", "cals_val", "request", "notif",
    ]}

    def quantity_read(uid: str, hk_type: str, output_name: str, mode: str = "From") -> dict:
        params: dict = {
            "WFHealthQuantityTypeKey": hk_type,
            "WFHealthDateRangePickerMode": mode,
            "CustomOutputName": output_name,
            "UUID": uid,
        }
        if mode == "From":
            params["WFHealthDateUnitKey"] = "Days"
            params["WFHealthStartDate"] = -1
        return {
            "WFWorkflowActionIdentifier": "is.workflow.actions.health.quantity.read",
            "WFWorkflowActionParameters": params,
        }

    def first_item(uid: str, input_uid: str, input_name: str, output_name: str) -> dict:
        return {
            "WFWorkflowActionIdentifier": "is.workflow.actions.getitemfromlist",
            "WFWorkflowActionParameters": {
                "WFItemIndex": 1,
                "WFInput": _output_ref(input_uid, input_name),
                "CustomOutputName": output_name,
                "UUID": uid,
            },
        }

    actions = [
        # 1. FC repos (dernières 24h)
        quantity_read(u["rhr"], "HKQuantityTypeIdentifierRestingHeartRate", "FC Repos"),

        # 2. HRV SDNN (dernières 24h)
        quantity_read(u["hrv"], "HKQuantityTypeIdentifierHeartRateVariabilitySDNN", "HRV"),

        # 3. Calories actives (hier, somme)
        quantity_read(u["cals"], "HKQuantityTypeIdentifierActiveEnergyBurned", "Calories", mode="Yesterday"),

        # 4. Date du jour
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.date",
            "WFWorkflowActionParameters": {
                "CustomOutputName": "Date Brute",
                "UUID": u["date"],
            },
        },

        # 5. Formater en YYYY-MM-DD
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.format.date",
            "WFWorkflowActionParameters": {
                "WFDateFormatStyle": "Custom",
                "WFDateFormat": "yyyy-MM-dd",
                "WFInput": _output_ref(u["date"], "Date Brute"),
                "CustomOutputName": "Date",
                "UUID": u["datefmt"],
            },
        },

        # 6. Première valeur FC
        first_item(u["rhr_val"], u["rhr"], "FC Repos", "FC Valeur"),

        # 7. Première valeur HRV
        first_item(u["hrv_val"], u["hrv"], "HRV", "HRV Valeur"),

        # 8. Première valeur Calories
        first_item(u["cals_val"], u["cals"], "Calories", "Calories Valeur"),

        # 9. Requête POST vers l'API
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
            "WFWorkflowActionParameters": {
                "WFURL": f"{backend_url.rstrip('/')}/api/wearable/sync",
                "WFHTTPMethod": "POST",
                "WFHTTPBodyType": "JSON",
                "WFHTTPRequestHeaders": _wf_dict([
                    _dict_field("Content-Type", _text_val("application/json")),
                    _dict_field("x-user-id", _text_val(user_id)),
                ]),
                "WFFormValues": _wf_dict([
                    _dict_field("date",            _output_ref(u["datefmt"], "Date"),           0),
                    _dict_field("resting_hr",      _output_ref(u["rhr_val"], "FC Valeur"),      3),
                    _dict_field("hrv_rmssd",       _output_ref(u["hrv_val"], "HRV Valeur"),     3),
                    _dict_field("active_calories", _output_ref(u["cals_val"], "Calories Valeur"), 3),
                ]),
                "UUID": u["request"],
            },
        },

        # 10. Notification de confirmation
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.notification.show",
            "WFWorkflowActionParameters": {
                "WFNotificationActionTitle": "Forme 1",
                "WFInput": _text_val("Apple Watch synchronisée ✓"),
                "UUID": u["notif"],
            },
        },
    ]

    workflow = {
        "WFWorkflowActions": actions,
        "WFWorkflowClientVersion": "1300.0.0",
        "WFWorkflowHasShortcutInputVariables": False,
        "WFWorkflowImportQuestions": [],
        "WFWorkflowInputContentItemClasses": [],
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowName": "Forme 1 — Sync Apple Watch",
        "WFWorkflowTypes": [],
    }

    buf = BytesIO()
    plistlib.dump(workflow, buf, fmt=plistlib.FMT_BINARY)
    return buf.getvalue()
