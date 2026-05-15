from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    anthropic_api_key: str
    allowed_origins: str = "http://localhost:3000,https://forme1.vercel.app"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
