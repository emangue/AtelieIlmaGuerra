"""
Modelo PedidoAtendimento — espelho de
app_dev/backend/app/domains/atendimentos/models.py. Ao mexer lá, mexa aqui.

O DDL desta tabela é criado só pelo backend de gestão. `pedido_id` é Integer
puro (sem ForeignKey) porque a tabela `pedidos` não existe no metadata deste
app — de propósito: aqui não se lê pedido nenhum.
"""
from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base

MEDIDAS_CAMPOS = (
    "medida_ombro",
    "medida_busto",
    "medida_cinto",
    "medida_quadril",
    "medida_comprimento_corpo",
    "medida_comprimento_vestido",
    "medida_distancia_busto",
    "medida_raio_busto",
    "medida_altura_busto",
    "medida_frente",
    "medida_costado",
    "medida_comprimento_calca",
    "medida_comprimento_blusa",
    "medida_largura_manga",
    "medida_comprimento_manga",
    "medida_punho",
    "medida_comprimento_saia",
    "medida_comprimento_bermuda",
)

TIPO_PEDIDO = "pedido"
TIPO_ORCAMENTO = "orcamento"
TIPOS_VALIDOS = (TIPO_PEDIDO, TIPO_ORCAMENTO)

STATUS_PENDENTE = "pendente"
STATUS_APROVADO = "aprovado"
STATUS_RECUSADO = "recusado"


class PedidoAtendimento(Base):
    __tablename__ = "pedidos_atendimento"

    id = Column(Integer, primary_key=True, index=True)

    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False, index=True)
    tipo = Column(String(20), nullable=False, default=TIPO_PEDIDO)
    tipo_pedido_id = Column(Integer, ForeignKey("tipo_pedido.id"), nullable=True)
    forma_peca_id = Column(Integer, ForeignKey("forma_peca.id"), nullable=True)

    descricao_produto = Column(Text, nullable=False, default="")
    data_pedido = Column(Date, nullable=False)
    data_entrega = Column(Date, nullable=True)
    quantidade_pecas = Column(Integer, nullable=True)
    valor_combinado = Column(Float, nullable=True)

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
    foto_url = Column(String(500), nullable=True)
    foto_url_2 = Column(String(500), nullable=True)
    foto_url_3 = Column(String(500), nullable=True)
    comentario_foto_1 = Column(Text, nullable=True)
    comentario_foto_2 = Column(Text, nullable=True)
    comentario_foto_3 = Column(Text, nullable=True)

    observacao_atendimento = Column(Text, nullable=True)

    status_aprovacao = Column(String(20), nullable=False, default=STATUS_PENDENTE, index=True)
    motivo_recusa = Column(Text, nullable=True)
    pedido_id = Column(Integer, nullable=True)

    criado_por_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    revisado_por_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    revisado_em = Column(DateTime, nullable=True)

    cliente = relationship("Cliente")
    tipo_pedido = relationship("TipoPedido")
    forma_peca = relationship("FormaPeca")
