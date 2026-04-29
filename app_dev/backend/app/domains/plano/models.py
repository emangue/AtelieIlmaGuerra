"""
Modelo PlanoItem - base unificada de receitas e despesas planejadas.
Fonte: PLANO 2026 ATELIE ILMA GUERRA.xlsx (MetaReceita + MetaDespesas).
"""
from sqlalchemy import Column, Integer, String, Float
from sqlalchemy.orm import relationship

from app.core.database import Base


class PlanoItem(Base):
    """Item do plano financeiro (receita ou despesa planejada)."""

    __tablename__ = "plano_itens"

    id = Column(Integer, primary_key=True, index=True)
    anomes = Column(String(6), nullable=False, index=True)  # YYYYMM
    tipo = Column(String(20), nullable=False, index=True)  # receita | despesa
    categoria = Column(String(50), nullable=False)  # Receita | Custo Variável | Custo Fixo
    tipo_item = Column(String(100), nullable=False)  # Vestido Noiva, Ajustes, Colaboradores, etc.
    detalhe = Column(String(255), nullable=True)  # Esli, Aluguel, etc. (despesas)
    quantidade = Column(Integer, nullable=True)  # Para receita
    ticket_medio = Column(Float, nullable=True)  # Para receita
    valor_planejado = Column(Float, nullable=False, default=0)
    valor_realizado = Column(Float, nullable=True)  # Para despesas (receita vem dos pedidos)

    pagamentos = relationship("Pagamento", back_populates="plano_item")
    despesas   = relationship("Despesa",   back_populates="plano_item")
