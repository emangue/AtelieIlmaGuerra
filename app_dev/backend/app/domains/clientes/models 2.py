"""
Model Cliente - cadastro de clientes do ateliê.
"""
from datetime import date, datetime

from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime

from app.core.database import Base


class Cliente(Base):
    """Cliente do ateliê."""

    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    appsheet_id = Column(String(50), unique=True, index=True, nullable=True)

    nome = Column(String(255), nullable=False)
    cpf = Column(String(20), nullable=True)
    rg = Column(String(50), nullable=True)
    endereco = Column(String(500), nullable=True)
    telefone = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)

    primeiro_agendamento = Column(String(100), nullable=True)
    data_cadastro = Column(Date, nullable=True)
    flag_medidas = Column(Boolean, default=False)

    # Medidas (cm)
    medida_ombro = Column(Float, nullable=True)
    medida_busto = Column(Float, nullable=True)
    medida_cinto = Column(Float, nullable=True)
    medida_quadril = Column(Float, nullable=True)
    medida_comprimento_corpo = Column(Float, nullable=True)
    medida_comprimento_vestido = Column(Float, nullable=True)
    medida_distancia_busto = Column(Float, nullable=True)
    medida_raio_busto = Column(Float, nullable=True)
    medida_altura_busto = Column(Float, nullable=True)
    medida_frente = Column(Float, nullable=True)
    medida_costado = Column(Float, nullable=True)
    medida_comprimento_calca = Column(Float, nullable=True)
    medida_comprimento_blusa = Column(Float, nullable=True)
    medida_largura_manga = Column(Float, nullable=True)
    medida_comprimento_manga = Column(Float, nullable=True)
    medida_punho = Column(Float, nullable=True)
    medida_comprimento_saia = Column(Float, nullable=True)
    medida_comprimento_bermuda = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
