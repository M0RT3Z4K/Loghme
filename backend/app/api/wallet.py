from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlmodel import Session

from app.core.security import decode_token
from app.db.session import get_session
from app.models.user import User

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
