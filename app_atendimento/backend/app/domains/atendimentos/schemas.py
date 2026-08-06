"""
Schemas do domínio Atendimentos.

Repare no que NÃO existe aqui: horas de trabalho, custo de materiais, custos
variáveis, margem, percentual de lucro. O balcão registra o que combinou com a
cliente; a precificação é da Ilma, na aprovação.
"""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from .models import TIPO_PEDIDO, TIPOS_VALIDOS


class _CamposMedidas(BaseModel):
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


class AtendimentoCreate(_CamposMedidas):
    cliente_id: int
    tipo: str = TIPO_PEDIDO
    tipo_pedido_id: Optional[int] = None
    forma_peca_id: Optional[int] = None
    descricao_produto: str = Field(default="", max_length=5000)
    data_pedido: date
    data_entrega: Optional[date] = None
    quantidade_pecas: Optional[int] = Field(default=None, ge=0)
    valor_combinado: Optional[float] = Field(default=None, ge=0)
    medidas_disponiveis: Optional[bool] = None
    comentario_medidas: Optional[str] = None
    fotos_disponiveis: Optional[bool] = None
    foto_url: Optional[str] = None
    foto_url_2: Optional[str] = None
    foto_url_3: Optional[str] = None
    comentario_foto_1: Optional[str] = None
    comentario_foto_2: Optional[str] = None
    comentario_foto_3: Optional[str] = None
    observacao_atendimento: Optional[str] = None

    @field_validator("tipo")
    @classmethod
    def _validar_tipo(cls, v: str) -> str:
        if v not in TIPOS_VALIDOS:
            raise ValueError(f"Tipo inválido. Use: {', '.join(TIPOS_VALIDOS)}")
        return v


class AtendimentoUpdate(_CamposMedidas):
    """Só vale enquanto o registro está pendente de aprovação."""

    tipo: Optional[str] = None
    tipo_pedido_id: Optional[int] = None
    forma_peca_id: Optional[int] = None
    descricao_produto: Optional[str] = Field(default=None, max_length=5000)
    data_entrega: Optional[date] = None
    quantidade_pecas: Optional[int] = Field(default=None, ge=0)
    valor_combinado: Optional[float] = Field(default=None, ge=0)
    medidas_disponiveis: Optional[bool] = None
    comentario_medidas: Optional[str] = None
    fotos_disponiveis: Optional[bool] = None
    foto_url: Optional[str] = None
    foto_url_2: Optional[str] = None
    foto_url_3: Optional[str] = None
    comentario_foto_1: Optional[str] = None
    comentario_foto_2: Optional[str] = None
    comentario_foto_3: Optional[str] = None
    observacao_atendimento: Optional[str] = None

    @field_validator("tipo")
    @classmethod
    def _validar_tipo(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in TIPOS_VALIDOS:
            raise ValueError(f"Tipo inválido. Use: {', '.join(TIPOS_VALIDOS)}")
        return v


class AtendimentoListItem(BaseModel):
    id: int
    tipo: str
    cliente_id: int
    cliente_nome: str
    tipo_pedido_id: Optional[int] = None
    tipo_pedido_nome: Optional[str] = None
    forma_peca_nome: Optional[str] = None
    descricao_produto: str
    data_pedido: date
    data_entrega: Optional[date] = None
    quantidade_pecas: Optional[int] = None
    valor_combinado: Optional[float] = None
    status_aprovacao: str
    motivo_recusa: Optional[str] = None
    criado_por_nome: str
    criado_em: Optional[datetime] = None
    revisado_em: Optional[datetime] = None
    foto_url: Optional[str] = None
    editavel: bool


class AtendimentoDetail(AtendimentoListItem, _CamposMedidas):
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
