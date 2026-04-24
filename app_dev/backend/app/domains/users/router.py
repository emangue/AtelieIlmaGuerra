"""
Router do domínio Users - gestão de usuários (admin).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.dependencies import require_admin, get_current_user_id
from .service import UserService
from .schemas import UserCreate, UserUpdate, UserResponse, UserListResponse, PasswordResetRequest, ChangePasswordRequest
from .models import User

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/me/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Altera a senha do usuário autenticado (requer senha atual)."""
    return UserService(db).change_password(user_id, data)


@router.get("", response_model=UserListResponse)
def list_users(
    apenas_ativos: bool = Query(True, description="Apenas usuários ativos"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Lista usuários (apenas admin)."""
    return UserService(db).list_users(apenas_ativos)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Busca usuário por ID (apenas admin)."""
    return UserService(db).get_user(user_id)


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Cria novo usuário (apenas admin)."""
    return UserService(db).create_user(data)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Atualiza usuário (apenas admin)."""
    return UserService(db).update_user(user_id, data)


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Desativa usuário (apenas admin)."""
    return UserService(db).delete_user(user_id)


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    data: PasswordResetRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Reseta senha de usuário (apenas admin)."""
    return UserService(db).reset_password(user_id, data)
