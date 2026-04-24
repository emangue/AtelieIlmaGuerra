"""
Service do domínio Users.
"""
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from .models import User
from .repository import UserRepository
from .schemas import UserCreate, UserUpdate, UserResponse, UserListResponse, PasswordResetRequest
from ..auth.password_utils import hash_password


class UserService:
    def __init__(self, db: Session):
        self.repo = UserRepository(db)

    def list_users(self, apenas_ativos: bool = True) -> UserListResponse:
        users = self.repo.list_all(apenas_ativos)
        total = self.repo.count_all(apenas_ativos)
        return UserListResponse(
            users=[UserResponse.model_validate(u) for u in users],
            total=total,
        )

    def get_user(self, user_id: int) -> UserResponse:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        return UserResponse.model_validate(user)

    def create_user(self, data: UserCreate) -> UserResponse:
        if self.repo.email_exists(data.email):
            raise HTTPException(status_code=400, detail="Email já cadastrado")
        now = datetime.now()
        user = User(
            email=data.email,
            nome=data.nome,
            password_hash=hash_password(data.password),
            role=data.role,
            ativo=1,
            created_at=now,
            updated_at=now,
        )
        created = self.repo.create(user)
        return UserResponse.model_validate(created)

    def update_user(self, user_id: int, data: UserUpdate) -> UserResponse:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        if data.email and data.email != user.email and self.repo.email_exists(data.email, user_id):
            raise HTTPException(status_code=400, detail="Email já cadastrado")
        if data.email is not None:
            user.email = data.email
        if data.nome is not None:
            user.nome = data.nome
        if data.role is not None:
            user.role = data.role
        if data.ativo is not None:
            user.ativo = data.ativo
        if data.password:
            user.password_hash = hash_password(data.password)
        user.updated_at = datetime.now()
        updated = self.repo.update(user)
        return UserResponse.model_validate(updated)

    def delete_user(self, user_id: int) -> dict:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        if user.role == "admin":
            raise HTTPException(status_code=403, detail="Não é possível desativar o administrador")
        self.repo.soft_delete(user)
        return {"message": "Usuário desativado com sucesso"}

    def reset_password(self, user_id: int, data: PasswordResetRequest) -> dict:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        user.password_hash = hash_password(data.nova_senha)
        user.updated_at = datetime.now()
        self.repo.update(user)
        return {"message": "Senha alterada com sucesso"}
