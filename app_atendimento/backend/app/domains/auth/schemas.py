"""
Schemas Pydantic do domínio Auth.

ESPELHO de app_dev/backend/app/domains/auth/schemas.py.
Cópia literal — se mexer lá, mexa aqui. O site de atendimento é um app separado
de propósito (isolamento de dados), e o preço disso é manter estes poucos
arquivos em sincronia.
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
