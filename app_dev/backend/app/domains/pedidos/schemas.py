"""
Schemas do domínio Pedidos.
"""
from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class TipoPedidoItem(BaseModel):
    id: int
    nome: str

    class Config:
        from_attributes = True


class PedidoHistoricoPercentualResumo(BaseModel):
    percentual: float
    quantidade: int
    valor: float


class PedidoHistoricoResponse(BaseModel):
    items: List["PedidoListItem"]
    total: int
    has_more: bool
    total_valor_pecas: float = 0
    percentuais_lucro_dono: List[PedidoHistoricoPercentualResumo] = []


class PedidoListItem(BaseModel):
    id: int
    cliente_id: int
    cliente_nome: str
    tipo_pedido_id: Optional[int] = None
    tipo_pedido_nome: Optional[str] = None
    descricao_produto: str
    status: str
    criado_como_orcamento: bool = False
    data_pedido: date
    data_entrega: Optional[date] = None
    foto_url: Optional[str] = None
    valor_pecas: Optional[float] = None
    quantidade_pecas: Optional[int] = None
    percentual_lucro_dono: Optional[float] = None
    forma_pagamento: Optional[str] = None
    pagamento_na_entrega: Optional[bool] = None
    status_pagamento: Optional[str] = None   # confirmado | aguardando | em_atraso | None
    parcelas_pagas: Optional[int] = None
    parcelas_total: Optional[int] = None

    class Config:
        from_attributes = True


class PedidoEntregueItem(BaseModel):
    """Pedido entregue no mês - para lista de transações no financeiro."""
    id: int
    tipo_pedido_nome: str
    valor_pecas: float
    data_entrega: date
    cliente_nome: str

    class Config:
        from_attributes = True


class PedidoStatusUpdate(BaseModel):
    status: str = Field(..., description="Orçamento, Encomenda, Cortado, Provado, Pronto, Entregue, Cancelado")


class PedidoCreate(BaseModel):
    cliente_id: int
    tipo_pedido_id: Optional[int] = None
    forma_peca_id: Optional[int] = None
    data_pedido: date
    data_entrega: Optional[date] = None
    descricao_produto: str = ""
    status: str = "Encomenda"
    valor_pecas: Optional[float] = Field(default=None, ge=0)
    quantidade_pecas: Optional[int] = Field(default=None, ge=0)
    horas_trabalho: Optional[float] = Field(default=None, ge=0)
    custo_materiais: Optional[float] = Field(default=None, ge=0)
    custos_variaveis: Optional[float] = Field(default=None, ge=0)
    confirmado_atipico: bool = False
    percentual_lucro_dono: Optional[float] = Field(default=None, ge=0, le=100)
    forma_pagamento: Optional[str] = None
    valor_entrada: Optional[float] = None
    valor_restante: Optional[float] = None
    detalhes_pagamento: Optional[str] = None
    canal_cartao: Optional[str] = None
    taxa_cartao_valor: Optional[float] = Field(default=None, ge=0)
    desconto_pix_valor: Optional[float] = Field(default=None, ge=0)
    medidas_disponiveis: Optional[bool] = None
    observacao_pedido: Optional[str] = None
    fotos_disponiveis: Optional[bool] = None
    foto_url: Optional[str] = None
    foto_url_2: Optional[str] = None
    foto_url_3: Optional[str] = None
    comentario_foto_1: Optional[str] = None
    comentario_foto_2: Optional[str] = None
    comentario_foto_3: Optional[str] = None
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
    comentario_medidas: Optional[str] = None


class PedidoUpdate(BaseModel):
    """Campos editáveis (exceto data_pedido, cliente_id, tipo_pedido_id)."""
    forma_peca_id: Optional[int] = None
    descricao_produto: Optional[str] = None
    status: Optional[str] = None
    data_entrega: Optional[date] = None
    valor_pecas: Optional[float] = Field(default=None, ge=0)
    quantidade_pecas: Optional[int] = Field(default=None, ge=0)
    horas_trabalho: Optional[float] = Field(default=None, ge=0)
    custo_materiais: Optional[float] = Field(default=None, ge=0)
    custos_variaveis: Optional[float] = Field(default=None, ge=0)
    confirmado_atipico: bool = False
    percentual_lucro_dono: Optional[float] = Field(default=None, ge=0, le=100)
    forma_pagamento: Optional[str] = None
    valor_entrada: Optional[float] = None
    valor_restante: Optional[float] = None
    detalhes_pagamento: Optional[str] = None
    canal_cartao: Optional[str] = None
    taxa_cartao_valor: Optional[float] = Field(default=None, ge=0)
    desconto_pix_valor: Optional[float] = Field(default=None, ge=0)
    recalcular_custos: bool = Field(
        default=False,
        description="Desliga o override manual e volta a calcular taxa e desconto pela tabela",
    )
    medidas_disponiveis: Optional[bool] = None
    fotos_disponiveis: Optional[bool] = None
    observacao_pedido: Optional[str] = None
    foto_url: Optional[str] = None
    foto_url_2: Optional[str] = None
    foto_url_3: Optional[str] = None
    comentario_foto_1: Optional[str] = None
    comentario_foto_2: Optional[str] = None
    comentario_foto_3: Optional[str] = None
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
    comentario_medidas: Optional[str] = None


class FormaPecaItem(BaseModel):
    id: int
    nome: str
    medidas: list[str] = []


class PedidoDetail(PedidoListItem):
    forma_peca_id: Optional[int] = None
    forma_peca_nome: Optional[str] = None
    valor_pecas: Optional[float] = None
    quantidade_pecas: Optional[int] = None
    horas_trabalho: Optional[float] = None
    custo_materiais: Optional[float] = None
    custos_variaveis: Optional[float] = None
    margem_real: Optional[float] = None
    forma_pagamento: Optional[str] = None
    valor_entrada: Optional[float] = None
    valor_restante: Optional[float] = None
    detalhes_pagamento: Optional[str] = None
    canal_cartao: Optional[str] = None
    data_compra_cartao: Optional[date] = None
    taxa_cartao_valor: Optional[float] = None
    taxa_cartao_percentual: Optional[float] = None
    taxa_cartao_manual: Optional[bool] = None
    desconto_pix_valor: Optional[float] = None
    desconto_pix_percentual: Optional[float] = None
    desconto_pix_manual: Optional[bool] = None
    medidas_disponiveis: Optional[bool] = None
    fotos_disponiveis: Optional[bool] = None
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
    comentario_medidas: Optional[str] = None
    observacao_pedido: Optional[str] = None
    param_preco_hora: Optional[float] = None
    param_impostos: Optional[float] = None
    param_cartao_credito: Optional[float] = None
    param_total_horas_mes: Optional[float] = None
    param_margem_target: Optional[float] = None
    percentual_lucro_dono: Optional[float] = None
    foto_url_2: Optional[str] = None
    foto_url_3: Optional[str] = None
    comentario_foto_1: Optional[str] = None
    comentario_foto_2: Optional[str] = None
    comentario_foto_3: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ParcelaCreate(BaseModel):
    valor: float
    data_vencimento: str  # YYYY-MM-DD
    data_pagamento: Optional[str] = None  # YYYY-MM-DD, None = não pago
    forma_pagamento: Optional[str] = None  # forma DESTA parcela (entrada Pix + resto no cartão)


class ParcelasConfig(BaseModel):
    forma_pagamento: Optional[str] = None       # forma do restante (legado: forma do pedido inteiro)
    entrada: Optional[ParcelaCreate] = None
    parcelas: List[ParcelaCreate] = []
    canal_cartao: Optional[str] = None          # "Maquininha" | "Link de pagamento"
    data_compra_cartao: Optional[str] = None    # YYYY-MM-DD — base do D+30
    taxa_cartao_valor: Optional[float] = None   # R$ informado à mão; None = calcular
    desconto_pix_valor: Optional[float] = None


class ParcelaOut(BaseModel):
    id: int
    parcela_numero: Optional[int] = None
    parcela_total: Optional[int] = None
    valor: float
    data_vencimento: Optional[str] = None
    data_pagamento: Optional[str] = None
    descricao: Optional[str] = None
    status: str  # confirmado | aguardando | em_atraso | previsto
    forma_pagamento: Optional[str] = None
    liquidacao_automatica: bool = False
    desconto_adiantamento: Optional[float] = None


class CustosReceberOut(BaseModel):
    """Quanto do pedido não chega na mão da Ilma."""
    taxa_cartao_valor: float = 0
    taxa_cartao_percentual: Optional[float] = None
    taxa_cartao_manual: bool = False
    desconto_pix_valor: float = 0
    desconto_pix_percentual: Optional[float] = None
    desconto_pix_manual: bool = False
    base_cartao: float = 0
    base_pix: float = 0
    pago_100_pct_pix: bool = False
    canal_cartao: Optional[str] = None
    data_compra_cartao: Optional[str] = None
    valor_liquido: float = 0
