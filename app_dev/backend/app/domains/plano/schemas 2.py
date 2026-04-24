"""
Schemas do domínio Plano.
"""
from pydantic import BaseModel
from typing import Optional, List


class PlanoItemOut(BaseModel):
    id: int
    anomes: str
    tipo: str
    categoria: str
    tipo_item: str
    detalhe: Optional[str] = None
    quantidade: Optional[int] = None
    ticket_medio: Optional[float] = None
    valor_planejado: float
    valor_realizado: Optional[float] = None

    class Config:
        from_attributes = True


class PlanoItemUpdateRealizado(BaseModel):
    """Atualiza apenas valor_realizado (despesas)."""
    valor_realizado: Optional[float] = None


class PlanoItemCreateDespesa(BaseModel):
    """Cria novo item de despesa no plano."""
    anomes: str  # YYYYMM
    categoria: str  # Custo Variável | Custo Fixo
    tipo_item: str  # Colaboradores, Espaço Físico, etc.
    detalhe: Optional[str] = None
    valor_planejado: float = 0
    valor_realizado: Optional[float] = None


class PlanoItemCreate(BaseModel):
    """Cria novo item no plano (receita ou despesa). Modo: plano (valor_planejado) ou realizado (valor_realizado)."""
    anomes: str  # YYYYMM
    tipo: str  # receita | despesa
    tipo_item: str  # Vestido Noiva, Colaboradores, etc.
    categoria: Optional[str] = None  # Para despesa: Custo Variável | Custo Fixo
    detalhe: Optional[str] = None
    valor_planejado: float = 0
    valor_realizado: Optional[float] = None


class PlanoResumoMes(BaseModel):
    """Resumo por mês: receita planejada, despesas planejadas, lucro planejado."""
    anomes: str
    receita_planejada: float
    despesas_planejadas: float
    lucro_planejado: float


# Mapeamento TipoPedido.nome -> plano tipo_item (para receita realizado)
TIPO_PEDIDO_TO_PLANO = {
    "AJUSTE": "Ajustes",
    "PEÇA CASUAL": "Peça Casual",
    "VESTIDO FESTA": "Vestido Festa",
    "NOIVA FESTA": "Vestido Noiva",
    "NOIVA CIVIL": "Vestido Noiva",
    "TRANSFORMAÇÃO": "Outros",
    "DEBUTANTE": "Outros",
    "CORTINA": "Outros",
}


class PlanoVsRealizadoItem(BaseModel):
    """Item linha a linha: planejado vs realizado."""
    tipo_item: str
    detalhe: Optional[str] = None
    valor_planejado: float
    valor_realizado: float
    status: str  # ok | abaixo | acima (para despesas acima=ruim, para receita acima=ok)


class DespesaRealizadaItem(BaseModel):
    """Despesa realizada do plano - para lista de transações."""
    id: int
    tipo_item: str
    detalhe: Optional[str] = None
    valor_realizado: float
    categoria: str

    class Config:
        from_attributes = True


class PlanoVsRealizado(BaseModel):
    """Plano vs realizado para o painel (card colapsável)."""
    anomes: str
    receita_planejada: float
    receita_realizada: float
    despesas_planejadas: float
    despesas_realizadas: float
    lucro_planejado: float
    lucro_realizado: float
    percentual_atingimento: float  # lucro_realizado / lucro_planejado * 100 (ou 0 se planejado=0)
    itens_receita: List[PlanoVsRealizadoItem]
    itens_despesas: List[PlanoVsRealizadoItem]
