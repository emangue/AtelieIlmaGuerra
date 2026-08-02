"""
Schemas Pydantic do domínio Users.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from .roles import ROLES_VALIDAS


def _validar_role(v: Optional[str]) -> Optional[str]:
    if v is not None and v not in ROLES_VALIDAS:
        raise ValueError(f"Perfil inválido. Use um destes: {', '.join(ROLES_VALIDAS)}")
    return v


class UserBase(BaseModel):
    email: EmailStr
    nome: str


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    role: str = "user"

    _check_role = field_validator("role")(_validar_role)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    nome: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    ativo: Optional[int] = None

    _check_role = field_validator("role")(_validar_role)


class UserResponse(UserBase):
    id: int
    role: str
    ativo: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int


class PasswordResetRequest(BaseModel):
    nova_senha: str = Field(..., min_length=6)


class ChangePasswordRequest(BaseModel):
    senha_atual: str = Field(..., min_length=1)
    nova_senha: str = Field(..., min_length=6)
