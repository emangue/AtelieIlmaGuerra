"""
Router do domínio Auth do site de atendimento.

O cookie tem nome próprio (`atendimento_token`) para nunca colidir com o do
gestão, mesmo que um dia os dois sites passem a dividir o domínio pai.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.shared.rate_limit import login_limiter

from .jwt_utils import extract_user_id_from_token
from .schemas import LoginRequest, UserLoginResponse
from .service import AuthService

COOKIE_NAME = "atendimento_token"

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _get_token_from_request(request: Request, authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.startswith("Bearer "):
        return authorization[len("Bearer "):]
    return request.cookies.get(COOKIE_NAME)


def _chave_rate_limit(request: Request, email: str) -> str:
    """Agrupa por IP + email: travar só por IP puniria todo mundo atrás do mesmo NAT."""
    ip = request.client.host if request.client else "desconhecido"
    return f"{ip}|{(email or '').strip().lower()}"


@router.post("/login")
def login(request: Request, credentials: LoginRequest, db: Session = Depends(get_db)):
    chave = _chave_rate_limit(request, credentials.email)
    faltam = login_limiter.segundos_de_bloqueio(chave)
    if faltam:
        minutos = max(1, faltam // 60)
        raise HTTPException(
            status_code=429,
            detail=f"Muitas tentativas de login. Tente novamente em {minutos} min.",
        )

    service = AuthService(db)
    try:
        token_response = service.login(credentials)
    except HTTPException as exc:
        if exc.status_code == 401:
            login_limiter.registrar_falha(chave)
        raise
    login_limiter.registrar_sucesso(chave)

    response = JSONResponse(content={
        "access_token": token_response.access_token,
        "token_type": token_response.token_type,
        "user": token_response.user.model_dump(),
    })
    response.set_cookie(
        key=COOKIE_NAME,
        value=token_response.access_token,
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        secure=not settings.DEBUG,
        httponly=True,
        samesite="strict",
    )
    return response


@router.get("/me", response_model=UserLoginResponse)
def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    token = _get_token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    user_id = extract_user_id_from_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido")
    return AuthService(db).get_current_user(user_id)


@router.post("/logout", status_code=204)
def logout():
    # Response, não JSONResponse: 204 não pode ter corpo, e um `{}` faz o h11
    # estourar "Too much data for declared Content-Length" a cada logout.
    response = Response(status_code=204)
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return response
