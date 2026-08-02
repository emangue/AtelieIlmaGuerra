"""
Schemas do domínio Atendimentos (lado gestão — leitura e aprovação).

A criação/edição desses registros acontece só no site de atendimento; aqui a
Ilma apenas revisa, aprova ou recusa.
"""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class AtendimentoListItem(BaseModel):
    id: int
    tipo: str
    cliente_id: int
    cliente_nome: str
    tipo_pedido_nome: Optional[str] = None
    forma_peca_nome: Optional[str] = None
    descricao_produto: str
    data_pedido: date
    data_entrega: Optional[date] = None
    quantidade_pecas: Optional[int] = None
    valor_combinado: Optional[float] = None
    status_aprovacao: str
    motivo_recusa: Optional[str] = None
    pedido_id: Optional[int] = None
    criado_por_nome: str
    criado_em: Optional[datetime] = None
    revisado_em: Optional[datetime] = None
    foto_url: Optional[str] = None


class AtendimentoDetail(AtendimentoListItem):
    tipo_pedido_id: Optional[int] = None
    forma_peca_id: Optional[int] = None
    observacao_atendimento: Optional[str] = None
    medidas_disponiveis: Optional[bool] = None
    comentario_medidas: Optional[str] = None
    fotos_disponiveis: Optional[bool] = None
    foto_url_2: Optional[str] = None
    foto_url_3: Optional[str] = None
    comentario_foto_1: Optional[str] = None
    comentario_foto_2: Optional[str] = None
    comentario_foto_3: Optional[str] = None
    revisado_por_nome: Optional[str] = None
    medida_ombro: Optional[float] = None
    medida_busto: Optional[float] = None
    medida_cinto: Optional[float] = None
    medida_quadril: Optional[float] = None
    medida_comprimento_corpo: Optional[float] = None
    medida_comprimento_vestido: Optional[float] = None
    medida_distancia_busto: Optional[float] = None
    medida_raio_busto: Optional[float] = None
    medida_altura_busto: Optional[float] = None
    medida_frente: Optional[float] = None
    medida_costado: Optional[float] = None
    medida_comprimento_calca: Optional[float] = None
    medida_comprimento_blusa: Optional[float] = None
    medida_largura_manga: Optional[float] = None
    medida_comprimento_manga: Optional[float] = None
    medida_punho: Optional[float] = None
    medida_comprimento_saia: Optional[float] = None
    medida_comprimento_bermuda: Optional[float] = None


class RecusaRequest(BaseModel):
    motivo: str = Field(..., min_length=3, description="Explicação enviada de volta ao atendimento")


class AprovacaoResponse(BaseModel):
    pedido_id: int
    atendimento: AtendimentoDetail


class AtendimentosPendentesCount(BaseModel):
    pendentes: int
