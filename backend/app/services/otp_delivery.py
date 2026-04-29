"""
تحویل کد OTP به شمارهٔ کاربر.

پیش‌فرض هیچ ارسالی انجام نمی‌دهد؛ منطق ارسال SMS / تماس / وب‌هوک را اینجا
یا در ماژول جدا پیاده کن و به API سرویس‌دهندهٔ خودت وصل کن.

مثال (فقط الگو — کامنت کن یا حذف کن):

    import httpx
    from app.core.config import settings

    def deliver_registration_otp(phone: str, code: str) -> None:
        httpx.post(
            settings.sms_api_url,
            json={"mobile": phone, "code": code},
            headers={"Authorization": f"Bearer {settings.sms_api_token}"},
            timeout=10,
        ).raise_for_status()
"""


def deliver_registration_otp(phone: str, code: str) -> None:
    """
    بعد از ساختن کد و ذخیره در Redis فراخوانی می‌شود.
    در صورت خطا در ارسال، می‌توانید استثنا پرتاب کنید تا کد از Redis حذف شود.
    """
    ...
