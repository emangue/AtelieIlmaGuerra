"""
Schemas do domínio Pedidos.
"""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class TipoPedidoItem(BaseModel):
    id: int
    nome: str

    class Config:
        from_attributes = True


class PedidoListItem(BaseModel):
    id: int
    cliente_id: int
    cliente_nome: str
    tipo_pedido_id: Optional[int] = None
    tipo_pedido_nome: Optional[str] = None
    descricao_produto: str
    status: str
    data_pedido: date
    data_entrega: Optional[date] = None
    foto_url: Optional[str] = None

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
    status: str = Field(..., description="Orçamento, Encomenda, Cortado, Provado, Pronto, Entregue, Canelado")


class PedidoCreate(BaseModel):
    cliente_id: int
    tipo_pedido_id: Optional[int] = None
    forma_peca_id: Optional[int] = None
    data_pedido: date
    data_entrega: Optional[date] = None
    descricao_produto: str = ""
    status: str = "Encomenda"
    valor_pecas: Optional[float] = None
    quantidade_pecas: Optional[int] = None
    horas_trabalho: Optional[float] = None
    custo_materiais: Optional[float] = None
    custos_variaveis: Optional[float] = None
    margem_real: Optional[float] = None
    param_preco_hora: Optional[float] = None
    param_impostos: Optional[float] = None
    param_cartao_credito: Optional[float] = None
    param_total_horas_mes: Optional[float] = None
    param_margem_target: Optional[float] = None
    forma_pagamento: Optional[str] = None
    valor_entrada: Optional[float] = None
    valor_restante: Optional[float] = None
    detalhes_pagamento: Optional[str] = None
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
    valor_pecas: Optional[float] = None
    quantidade_pecas: Optional[int] = None
    horas_trabalho: Optional[float] = None
    custo_materiais: Optional[float] = None
    custos_variaveis: Optional[float] = None
    forma_pagamento: Optional[str] = None
    valor_entrada: Optional[float] = None
    valor_restante: Optional[float] = None
    detalhes_pagamento: Optional[str] = None
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
    foto_url_2: Optional[str] = None
    foto_url_3: Optional[str] = None
    comentario_foto_1: Optional[str] = None
    comentario_foto_2: Optional[str] = None
    comentario_foto_3: Optional[str] = None
    created_at: datetime
    updated_at: datetime
