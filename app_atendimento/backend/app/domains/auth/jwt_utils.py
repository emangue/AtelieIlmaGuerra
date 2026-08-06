"""
Utilitários para JWT do site de atendimento.

Duas barreiras separam esta sessão da do app de gestão:
1. `settings.JWT_SECRET_KEY` é outro segredo;
2. a claim `app` marca quem emitiu o token, e cada app rejeita a do outro.

Basta uma das duas para o isolamento funcionar; as duas juntas cobrem o caso de
alguém copiar o .env errado num deploy.
"""
from datetime import datetime, timedelta
from typing import Dict, Optional

from jose import JWTError, jwt

from app.core.config import settings

APP_CLAIM = "atendimento"


def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "access", "app": APP_CLAIM})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_jwt(token: str) -> Dict:
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("app") != APP_CLAIM:
        raise JWTError("Token emitido por outro aplicativo")
    return payload


def extract_user_id_from_token(token: str) -> Optional[int]:
    try:
        payload = decode_jwt(token)
        return payload.get("user_id")
    except JWTError:
        return None
