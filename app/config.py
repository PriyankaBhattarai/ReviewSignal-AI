from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ReviewSignal AI"
    database_url: str = "sqlite:///./reviewsignal.db"
    llm_provider: str = "mock"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "YOUR_MODEL_NAME"
    llm_api_key: str = ""
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
