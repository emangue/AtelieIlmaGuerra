"""
Utilitários para JWT.
"""
from datetime import datetime, timedelta
from typing import Dict, Optional
from jose import JWTError, jwt

from app.core.config import settings


def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_jwt(token: str) -> Dict:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def extract_user_id_from_token(token: str) -> Optional[int]:
    try:
        payload = decode_jwt(token)
        return payload.get("user_id")
    except JWTError:
        return None
