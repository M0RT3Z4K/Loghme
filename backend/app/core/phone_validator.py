"""Iranian mobile numbers: normalize to 09xxxxxxxxx and validate."""

import re

_PHONE_RE = re.compile(r"^09\d{9}$")


def normalize_phone(raw: str) -> str:
    """Strip spaces, accept 09… / +98… / 9… (10 digits), return 09xxxxxxxxx."""
    s = re.sub(r"\s+", "", (raw or "").strip())
    digits = re.sub(r"\D", "", s)
    if not digits:
        raise ValueError("Phone number is required")
    if digits.startswith("0098"):
        digits = digits[4:]
    elif digits.startswith("98") and len(digits) >= 12:
        digits = digits[2:]
    if len(digits) == 10 and digits.startswith("9"):
        digits = "0" + digits
    if len(digits) == 11 and digits.startswith("09"):
        if not _PHONE_RE.fullmatch(digits):
            raise ValueError("Invalid Iranian mobile number")
        return digits
    raise ValueError("Invalid Iranian mobile number (use 09xxxxxxxxx or +989… )")


def validate_phone(raw: str) -> str:
    """Return normalized phone or raise ValueError."""
    return normalize_phone(raw)
