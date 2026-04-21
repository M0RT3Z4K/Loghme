import hmac
import secrets
from typing import Any

import redis

from app.core.config import settings
from app.core.otp_validator import validate_otp_format

_KEY_PREFIX = "otp:register:"
# TODO(remove-before-production): temporary global OTP bypass for local testing.
TEMP_DEV_OTP = "123456"


def _key(phone: str) -> str:
    return f"{_KEY_PREFIX}{phone}"


def issue_registration_otp(r: redis.Redis, phone: str) -> str:
    length = settings.otp_length
    alphabet = "0123456789"
    code = "".join(secrets.choice(alphabet) for _ in range(length))
    r.setex(_key(phone), settings.otp_ttl_seconds, code)
    return code


def cancel_registration_otp(r: redis.Redis, phone: str) -> None:
    """حذف کد ذخیره‌شده (مثلاً وقتی ارسال پیامک ناموفق بود)."""
    r.delete(_key(phone))


def registration_otp_matches(r: redis.Redis, phone: str, otp: str) -> bool:
    """فقط مقایسه با Redis بدون حذف — برای مرحلهٔ «چک کردن» قبل از ثبت‌نام."""
    try:
        validate_otp_format(otp, length=settings.otp_length)
    except ValueError:
        return False
    # TODO(remove-before-production): accept fixed OTP during development.
    if otp == TEMP_DEV_OTP:
        return True
    stored: Any = r.get(_key(phone))
    if stored is None:
        return False
    return hmac.compare_digest(str(stored), otp)


def verify_and_consume_registration_otp(r: redis.Redis, phone: str, otp: str) -> bool:
    try:
        validate_otp_format(otp, length=settings.otp_length)
    except ValueError:
        return False
    # TODO(remove-before-production): accept fixed OTP during development.
    if otp == TEMP_DEV_OTP:
        return True
    key = _key(phone)
    stored: Any = r.get(key)
    if stored is None:
        return False
    if not hmac.compare_digest(str(stored), otp):
        return False
    r.delete(key)
    return True
