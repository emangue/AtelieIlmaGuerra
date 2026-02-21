"""
Router do domínio Auth.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from .service import AuthService
from .jwt_utils import extract_user_id_from_token
from .schemas import LoginRequest, TokenResponse, UserLoginResponse


router = APIRouter(prefix="/auth", tags=["Authentication"])


def _get_token_from_request(request: Request, authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.startswith("Bearer "):
        return authorization.replace("Bearer ", "")
    return request.cookies.get("auth_token")


@router.post("/login")
def login(request: Request, credentials: LoginRequest, db: Session = Depends(get_db)):
    service = AuthService(db)
    token_response = service.login(credentials)
    data = {
        "access_token": token_response.access_token,
        "token_type": token_response.token_type,
        "user": token_response.user.model_dump(),
    }
    response = JSONResponse(content=data)
    response.set_cookie(
        key="auth_token",
        value=token_response.access_token,
        max_age=3600,
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
    service = AuthService(db)
    return service.get_current_user(user_id)


@router.post("/logout", status_code=204)
def logout():
    response = JSONResponse(content={}, status_code=204)
    response.delete_cookie(key="auth_token", path="/")
    return response


def get_user_id_from_token(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> int:
    token = _get_token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    user_id = extract_user_id_from_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido")
    return user_id
