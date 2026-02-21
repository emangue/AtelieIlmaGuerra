"""
Dependências compartilhadas - autenticação e autorização.
"""
from typing import Optional, TYPE_CHECKING
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domains.auth.jwt_utils import extract_user_id_from_token

if TYPE_CHECKING:
    from app.domains.users.models import User


def _get_token(request: Request, authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.startswith("Bearer "):
        return authorization.replace("Bearer ", "")
    return request.cookies.get("auth_token")


def get_current_user_id(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> int:
    """Retorna user_id do JWT. Levanta 401 se token inválido."""
    token = _get_token(request, authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação não fornecido",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = extract_user_id_from_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id


def require_admin(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> "User":
    """Retorna o User se for admin. Levanta 403 se não for."""
    from app.domains.users.models import User

    user_id = get_current_user_id(request, authorization)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado. Apenas administradores.",
        )
    return user
