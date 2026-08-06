"""
Service do domínio Auth do site de atendimento.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.domains.users.roles import ROLES_ATENDIMENTO

from .jwt_utils import create_access_token
from .password_utils import verify_password
from .repository import AuthRepository
from .schemas import LoginRequest, TokenResponse, UserLoginResponse


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = AuthRepository(db)

    def login(self, credentials: LoginRequest) -> TokenResponse:
        user = self.repository.get_user_by_email(credentials.email)
        if not user:
            raise HTTPException(status_code=401, detail="Email ou senha incorretos")
        if not user.ativo:
            raise HTTPException(status_code=401, detail="Usuário desativado")
        if not verify_password(credentials.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Email ou senha incorretos")
        if user.role not in ROLES_ATENDIMENTO:
            raise HTTPException(
                status_code=403,
                detail="Este login é do sistema de gestão: gestao.atelieilmaguerra.com.br",
            )

        access_token = create_access_token(
            data={"user_id": user.id, "email": user.email, "role": user.role}
        )
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserLoginResponse.model_validate(user),
        )

    def get_current_user(self, user_id: int) -> UserLoginResponse:
        user = self.repository.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        return UserLoginResponse.model_validate(user)
