"""
Modelos do domínio Pedidos.
"""
from datetime import date, datetime

from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, Text, ForeignKey, Table
from sqlalchemy.orm import relationship

from app.core.database import Base


class FormaPeca(Base):
    """Catálogo de formas de peça (Saia, Calça, Bermuda, Vestido, Blusa)."""

    __tablename__ = "forma_peca"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False, unique=True)


class FormaPecaMedida(Base):
    """Medidas associadas a cada forma de peça."""

    __tablename__ = "forma_peca_medidas"

    forma_peca_id = Column(Integer, ForeignKey("forma_peca.id"), primary_key=True)
    medida_key = Column(String(50), primary_key=True)


# Tabela associativa: quais formas de peça são válidas para cada tipo de pedido
tipo_pedido_forma_peca = Table(
    "tipo_pedido_forma_peca",
    Base.metadata,
    Column("tipo_pedido_id", Integer, ForeignKey("tipo_pedido.id"), primary_key=True),
    Column("forma_peca_id", Integer, ForeignKey("forma_peca.id"), primary_key=True),
)


class TipoPedido(Base):
    """Catálogo de tipos de pedido."""

    __tablename__ = "tipo_pedido"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False, unique=True)
    meta_lucro = Column(Float, nullable=True)
    meta_quantidade = Column(Integer, nullable=True)

    formas_peca = relationship(
        "FormaPeca",
        secondary=tipo_pedido_forma_peca,
        backref="tipos_pedido",
    )


class Pedido(Base):
    """Pedido do ateliê."""

    __tablename__ = "pedidos"

    id = Column(Integer, primary_key=True, index=True)
    appsheet_id = Column(String(50), unique=True, index=True, nullable=True)

    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    tipo_pedido_id = Column(Integer, ForeignKey("tipo_pedido.id"), nullable=True)
    forma_peca_id = Column(Integer, ForeignKey("forma_peca.id"), nullable=True)

    data_pedido = Column(Date, nullable=False)
    data_entrega = Column(Date, nullable=True)
    descricao_produto = Column(Text, nullable=False, default="")
    status = Column(String(50), nullable=False, default="Encomenda")

    valor_pecas = Column(Float, nullable=True)
    quantidade_pecas = Column(Integer, nullable=True)
    horas_trabalho = Column(Float, nullable=True)
    custo_materiais = Column(Float, nullable=True)
    custos_variaveis = Column(Float, nullable=True)
    margem_real = Column(Float, nullable=True)

    # Snapshot dos parâmetros usados no cálculo (preco_hora, impostos, etc.)
    param_preco_hora = Column(Float, nullable=True)
    param_impostos = Column(Float, nullable=True)
    param_cartao_credito = Column(Float, nullable=True)
    param_total_horas_mes = Column(Float, nullable=True)
    param_margem_target = Column(Float, nullable=True)

    forma_pagamento = Column(String(50), nullable=True)
    valor_entrada = Column(Float, nullable=True)
    valor_restante = Column(Float, nullable=True)
    detalhes_pagamento = Column(Text, nullable=True)

    medidas_disponiveis = Column(Boolean, default=False)
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
    comentario_medidas = Column(Text, nullable=True)

    fotos_disponiveis = Column(Boolean, default=False)
    observacao_pedido = Column(Text, nullable=True)
    foto_url = Column(String(500), nullable=True)
    foto_url_2 = Column(String(500), nullable=True)
    foto_url_3 = Column(String(500), nullable=True)
    comentario_foto_1 = Column(Text, nullable=True)
    comentario_foto_2 = Column(Text, nullable=True)
    comentario_foto_3 = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relacionamentos
    cliente = relationship("Cliente", backref="pedidos")
    tipo_pedido = relationship("TipoPedido", backref="pedidos")
    forma_peca = relationship("FormaPeca", backref="pedidos")
