"""
Schemas Pydantic do domínio Auth.
"""
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserLoginResponse"


class UserLoginResponse(BaseModel):
    id: int
    email: str
    nome: str
    role: str

    class Config:
        from_attributes = True


class LogoutRequest(BaseModel):
    pass


TokenResponse.model_rebuild()
