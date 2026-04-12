import os

class Settings:
    supabase_url: str = os.environ["SUPABASE_URL"]
    supabase_service_key: str = os.environ["SUPABASE_SERVICE_KEY"]
    anthropic_api_key: str = os.environ["ANTHROPIC_API_KEY"]
    allowed_origins: str = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")

settings = Settings()
