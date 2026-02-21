"""
Schemas Pydantic do domínio Users.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    nome: str


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    role: str = "user"


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    nome: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    ativo: Optional[int] = None


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
