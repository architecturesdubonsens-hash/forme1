from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_service_key: str
    anthropic_api_key: str
    allowed_origins: str = "http://localhost:3000"

settings = Settings()
