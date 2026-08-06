"""
Domínio Users - Model

ESPELHO de app_dev/backend/app/domains/users/models.py.
Cópia literal — se mexer lá, mexa aqui. O site de atendimento é um app separado
de propósito (isolamento de dados), e o preço disso é manter estes poucos
arquivos em sincronia.
"""
from sqlalchemy import Column, Integer, String, DateTime
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    nome = Column(String(200), nullable=False)
    ativo = Column(Integer, default=1)
    role = Column(String(20), default="user")
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
