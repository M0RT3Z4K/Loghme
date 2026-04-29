from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import httpx
from jose import JWTError
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import get_session
from app.models.user import User
from app.models.wallet_transaction import WalletTransaction

router = APIRouter()
security = HTTPBearer(auto_error=False)


def get_current_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(creds.credentials)
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Invalid token")
        return str(sub)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token") from None


@router.get("/balance")
def wallet_balance(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
) -> dict:
    uid = int(user_id)
    user = session.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"wallet_balance": user.wallet_balance}


class TopupRequestBody(BaseModel):
    amount_toman: int


@router.post("/topup/request")
def topup_request(
    body: TopupRequestBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
) -> dict:
    if body.amount_toman < settings.min_wallet_topup_toman:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum topup amount is {settings.min_wallet_topup_toman} toman",
        )
    uid = int(user_id)
    user = session.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # if not settings.zarinpal_merchant_id:
    #     raise HTTPException(status_code=500, detail="Zarinpal merchant id is not configured")

    amount_for_gateway = body.amount_toman * settings.zarinpal_amount_multiplier
    req_payload = {
        "merchant_id": settings.zarinpal_merchant_id,
        "amount": amount_for_gateway,
        "callback_url": settings.payment_callback_url,
        "description": "Loghme wallet topup",
        "metadata": {"mobile": user.phone},
    }
    try:
        resp = httpx.post(settings.zarinpal_request_url, json=req_payload, timeout=30)
        resp.raise_for_status()
        data = resp.json().get("data", {})
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Zarinpal request failed: {exc}") from exc

    authority = data.get("authority")
    if not authority:
        errors = resp.json().get("errors")
        raise HTTPException(status_code=400, detail=f"Zarinpal request rejected: {errors}")

    tx = WalletTransaction(
        user_id=uid,
        amount_toman=body.amount_toman,
        status="pending",
        gateway="zarinpal",
        authority=authority,
        description="wallet topup",
    )
    session.add(tx)
    session.commit()
    session.refresh(tx)
    payment_url = f"{settings.zarinpal_startpay_base}{authority}"
    return {
        "transaction_id": tx.id,
        "authority": authority,
        "payment_url": payment_url,
        "callback_url": settings.payment_callback_url,
    }


@router.get("/topup/verify")
def topup_verify(
    authority: str,
    status: str | None = None,
    session: Session = Depends(get_session),
) -> dict:
    tx = session.exec(select(WalletTransaction).where(WalletTransaction.authority == authority)).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if status and status.upper() != "OK":
        tx.status = "failed"
        session.add(tx)
        session.commit()
        return {"ok": False, "status": tx.status}

    if tx.status != "paid":
        if not settings.zarinpal_merchant_id:
            raise HTTPException(status_code=500, detail="Zarinpal merchant id is not configured")
        verify_payload = {
            "merchant_id": settings.zarinpal_merchant_id,
            "amount": tx.amount_toman * settings.zarinpal_amount_multiplier,
            "authority": authority,
        }
        try:
            resp = httpx.post(settings.zarinpal_verify_url, json=verify_payload, timeout=30)
            resp.raise_for_status()
            verify_data = resp.json().get("data", {})
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Zarinpal verify failed: {exc}") from exc

        code = int(verify_data.get("code", -1))
        if code not in (100, 101):
            tx.status = "failed"
            session.add(tx)
            session.commit()
            return {"ok": False, "status": tx.status, "gateway_code": code}

        user = session.get(User, tx.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.wallet_balance += float(tx.amount_toman)
        tx.status = "paid"
        tx.ref_id = str(verify_data.get("ref_id") or tx.ref_id or "")
        session.add(user)
        session.add(tx)
        session.commit()
    return {"ok": True, "status": tx.status, "wallet_balance": session.get(User, tx.user_id).wallet_balance}
