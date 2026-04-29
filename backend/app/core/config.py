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
    openrouter_memory_model: str = "openai/gpt-4o-mini"
    openrouter_models_url: str = "https://openrouter.ai/api/v1/models"
    openrouter_usd_to_toman: int = 85000
    wallex_markets_url: str = "https://api.wallex.ir/v1/markets"
    wallex_usdt_toman_symbol: str = "USDTTMN"
    openrouter_default_max_output_tokens: int = 800
    short_term_max_messages: int = 10
    min_wallet_topup_toman: int = 30000
    zarinpal_merchant_id: str = '6cd3e482-d938-44dc-bbdb-d8516ae7d6e8'
    zarinpal_request_url: str = "https://payment.zarinpal.com/pg/v4/payment/request.json"
    zarinpal_verify_url: str = "https://payment.zarinpal.com/pg/v4/payment/verify.json"
    zarinpal_startpay_base: str = "https://payment.zarinpal.com/pg/StartPay/"
    zarinpal_amount_multiplier: int = 10
    payment_callback_url: str = "http://localhost:8000/api/wallet/topup/verify"
    otp_ttl_seconds: int = 300
    otp_length: int = 6
    otp_mock_return: bool = Field(default=False, validation_alias="OTP_MOCK_RETURN")
    long_term_memory_enabled: bool = False  # Set to True to enable long-term memory features:


settings = Settings()
