"""Modelos de acervo e aluguéis."""
from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class ItemAcervo(Base):
    __tablename__ = "itens_acervo"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(50), nullable=False, unique=True, index=True)
    nome = Column(String(255), nullable=False)
    categoria = Column(String(30), nullable=False)  # Vestido | Acessório
    tamanho = Column(String(30), nullable=True)
    cor = Column(String(80), nullable=True)
    valor_reposicao = Column(Float, nullable=True)
    observacao = Column(Text, nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Aluguel(Base):
    __tablename__ = "alugueis"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False, index=True)
    data_reserva = Column(Date, nullable=False)
    data_retirada = Column(Date, nullable=False, index=True)
    data_devolucao_prevista = Column(Date, nullable=False, index=True)
    data_retirada_real = Column(Date, nullable=True)
    data_devolucao_real = Column(Date, nullable=True)
    status = Column(String(30), nullable=False, default="Reservado", index=True)
    valor_total = Column(Float, nullable=False, default=0)
    valor_caucao = Column(Float, nullable=False, default=0)
    forma_pagamento = Column(String(50), nullable=True)
    observacao = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cliente = relationship("Cliente", backref="alugueis")
    itens = relationship("AluguelItem", back_populates="aluguel", cascade="all, delete-orphan")


class AluguelItem(Base):
    __tablename__ = "aluguel_itens"
    __table_args__ = (UniqueConstraint("aluguel_id", "item_acervo_id", name="uq_aluguel_item"),)

    id = Column(Integer, primary_key=True)
    aluguel_id = Column(Integer, ForeignKey("alugueis.id", ondelete="CASCADE"), nullable=False, index=True)
    item_acervo_id = Column(Integer, ForeignKey("itens_acervo.id"), nullable=False, index=True)
    valor_aluguel = Column(Float, nullable=False, default=0)

    aluguel = relationship("Aluguel", back_populates="itens")
    item = relationship("ItemAcervo", backref="alugueis_itens")
