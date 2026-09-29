"""Configuration du logging pour Forme1 — envoie les erreurs vers Supabase."""
import os
import logging
import traceback
from datetime import datetime, timezone

try:
    from supabase import create_client
except ImportError:
    create_client = None


class SupabaseLogHandler(logging.Handler):
    """Handler qui écrit les logs dans la table Supabase app_logs."""

    def __init__(self):
        super().__init__()
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_KEY", ""))
        self.client = create_client(url, key) if (create_client and url and key) else None

    def emit(self, record):
        if not self.client:
            return
        try:
            log_entry = {
                "level": record.levelname,
                "logger": record.name,
                "message": self.format(record),
                "module": record.module,
                "function": record.funcName,
                "line": record.lineno,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "exc_info": (
                    traceback.format_exception(
                        record.exc_info[0], record.exc_info[1], record.exc_info[2]
                    )
                    if record.exc_info
                    else None
                ),
            }
            self.client.table("app_logs").insert(log_entry).execute()
        except Exception:
            pass


class LoggingMiddleware:
    """Middleware FastAPI qui log les erreurs 5xx."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        try:
            await self.app(scope, receive, send)
        except Exception as exc:
            logger = logging.getLogger("forme1.errors")
            logger.error(
                f"Unhandled error on {scope.get('method', '?')} {scope.get('path', '?')}: {exc}",
                exc_info=True,
            )
            raise


def setup_logging():
    """Configure le logging global pour Forme1."""
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    root.addHandler(console)
    try:
        handler = SupabaseLogHandler()
        handler.setLevel(logging.ERROR)
        root.addHandler(handler)
    except Exception:
        logging.warning("SupabaseLogHandler non disponible")
