from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from redis import Redis
from sqlmodel import Session, select

from app.core.config import settings
from app.core.otp_validator import validate_otp_format
from app.core.phone_validator import normalize_phone
from app.core.security import create_access_token, create_refresh_token, hash_password, verify_password
from app.db.redis import get_redis
from app.db.session import get_session
from app.models.user import User
from app.services import otp_delivery, otp_service

router = APIRouter()


def _validate_phone_field(v: str) -> str:
    try:
        return normalize_phone(v)
    except ValueError as e:
        raise ValueError(str(e)) from e


class SendOtpBody(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def phone_valid(cls, v: str) -> str:
        return _validate_phone_field(v)


class RegisterBody(BaseModel):
    phone: str
    password: str
    otp: str
    full_name: str | None = None

    @field_validator("phone")
    @classmethod
    def phone_valid(cls, v: str) -> str:
        return _validate_phone_field(v)

    @field_validator("otp")
    @classmethod
    def otp_valid(cls, v: str) -> str:
        try:
            return validate_otp_format(v, length=settings.otp_length)
        except ValueError as e:
            raise ValueError(str(e)) from e


class LoginBody(BaseModel):
    phone: str
    password: str

    @field_validator("phone")
    @classmethod
    def phone_valid(cls, v: str) -> str:
        return _validate_phone_field(v)


class CheckOtpBody(BaseModel):
    phone: str
    otp: str

    @field_validator("phone")
    @classmethod
    def phone_valid(cls, v: str) -> str:
        return _validate_phone_field(v)

    @field_validator("otp")
    @classmethod
    def otp_valid(cls, v: str) -> str:
        try:
            return validate_otp_format(v, length=settings.otp_length)
        except ValueError as e:
            raise ValueError(str(e)) from e


@router.post("/send-otp")
def send_otp(
    body: SendOtpBody,
    session: Session = Depends(get_session),
    r: Redis = Depends(get_redis),
) -> dict:
    existing = session.exec(select(User).where(User.phone == body.phone)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Phone already registered")
    code = otp_service.issue_registration_otp(r, body.phone)
    try:
        otp_delivery.deliver_registration_otp(body.phone, code)
    except Exception as exc:
        otp_service.cancel_registration_otp(r, body.phone)
        raise HTTPException(
            status_code=502,
            detail="Could not send verification code. Try again later.",
        ) from exc
    out: dict = {"expires_in": settings.otp_ttl_seconds}
    if settings.otp_mock_return:
        out["mock_otp"] = code
    return out


@router.post("/check-otp")
def check_otp(body: CheckOtpBody, r: Redis = Depends(get_redis)) -> dict:
    """فقط بررسی می‌کند کد با Redis یکی است؛ کد را پاک نمی‌کند تا همان را در /register بفرستی."""
    valid = otp_service.registration_otp_matches(r, body.phone, body.otp)
    return {"valid": valid}


@router.post("/register")
def register(
    body: RegisterBody,
    session: Session = Depends(get_session),
    r: Redis = Depends(get_redis),
) -> dict:
    if not otp_service.verify_and_consume_registration_otp(r, body.phone, body.otp):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    existing = session.exec(select(User).where(User.phone == body.phone)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Phone already registered")
    user = User(
        phone=body.phone,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"id": user.id, "phone": user.phone}


@router.post("/login")
def login(body: LoginBody, session: Session = Depends(get_session)) -> dict:
    user = session.exec(select(User).where(User.phone == body.phone)).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
    }
