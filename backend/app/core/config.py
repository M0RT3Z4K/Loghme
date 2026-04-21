from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str
    redis_url: str = "redis://redis:6379/0"
    secret_key: str
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_default_model: str = "openai/gpt-4o-mini"
    otp_ttl_seconds: int = 300
    otp_length: int = 6
    otp_mock_return: bool = Field(default=False, validation_alias="OTP_MOCK_RETURN")


settings = Settings()
