"""OTP string format validation (numeric code of fixed length)."""


def validate_otp_format(otp: str, *, length: int = 6) -> str:
    if length < 4 or length > 12:
        raise ValueError("Invalid OTP length configuration")
    t = (otp or "").strip()
    if not t.isdigit() or len(t) != length:
        raise ValueError(f"OTP must be exactly {length} digits")
    return t
