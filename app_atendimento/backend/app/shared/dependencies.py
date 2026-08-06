"""
Dependências de autenticação do site de atendimento.

Diferente do gestão, aqui existe uma única dependência: estar autenticado com
um token emitido por ESTE app. Não há níveis de permissão porque não há nada
privilegiado a proteger — a superfície inteira da API é o que o atendimento
pode fazer.
"""
from typing import Optional

from fastapi import Header, HTTPException, Request, status

from app.domains.auth.jwt_utils import extract_user_id_from_token
from app.domains.auth.router import COOKIE_NAME


def get_current_user_id(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> int:
    """Retorna o user_id do JWT. Levanta 401 se o token faltar ou for inválido."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):]
    else:
        token = request.cookies.get(COOKIE_NAME)

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
