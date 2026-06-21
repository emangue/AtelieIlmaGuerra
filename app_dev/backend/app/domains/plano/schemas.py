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
    transacoes_count: Optional[int] = None

    class Config:
        from_attributes = True


class PlanoItemUpdateRealizado(BaseModel):
    """Atualiza apenas valor_realizado (despesas). Deprecado: use transações."""
    valor_realizado: Optional[float] = None


class PlanoItemUpdate(BaseModel):
    """Atualiza campos do plano. valor_realizado vem das transações."""
    valor_planejado: Optional[float] = None
    quantidade: Optional[int] = None
    ticket_medio: Optional[float] = None
    detalhe: Optional[str] = None


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
    """Resumo por mês: planejado e realizado."""
    anomes: str
    receita_planejada: float
    despesas_planejadas: float
    lucro_planejado: float
    receita_realizada: float = 0
    despesas_realizadas: float = 0
    lucro_realizado: float = 0


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


class OpcaoDespesa(BaseModel):
    """Opção para dropdown ao adicionar despesa realizada."""
    plano_item_id: Optional[int] = None
    label: str  # "Pró-Labore (Colaboradores)"
    tipo_item: str
    detalhe: Optional[str] = None
    categoria: str


class DespesaTransacaoCreate(BaseModel):
    """Cria transação de despesa. Use plano_item_id OU (tipo_item, detalhe, categoria) para catálogo."""
    anomes: str  # YYYYMM
    plano_item_id: Optional[int] = None  # Se informado, usa este item
    tipo_item: Optional[str] = None  # Para criar item do catálogo
    detalhe: Optional[str] = None
    categoria: Optional[str] = None  # Custo Fixo | Custo Variável
    valor: float
    data: Optional[str] = None  # YYYY-MM-DD
    descricao: Optional[str] = None


class DespesaTransacaoUpdate(BaseModel):
    """Atualiza transação."""
    valor: Optional[float] = None
    data: Optional[str] = None
    descricao: Optional[str] = None


class DespesaTransacaoOut(BaseModel):
    """Transação de despesa para resposta."""
    id: int
    anomes: str
    plano_item_id: int
    valor: float
    data: Optional[str] = None
    descricao: Optional[str] = None
    tipo_item: Optional[str] = None
    detalhe: Optional[str] = None


class PlanoVsRealizado(BaseModel):
    """Plano vs realizado para o painel (card colapsável)."""
    anomes: str
    receita_planejada: float
    receita_realizada: float        # visão pagamento: soma dos pagamentos com anomes == mes
    receita_por_entrega: float = 0.0  # visão entrega: soma valor_pecas com data_entrega no mes
    despesas_planejadas: float
    despesas_realizadas: float
    lucro_planejado: float
    lucro_realizado: float
    percentual_atingimento: float  # lucro_realizado / lucro_planejado * 100 (ou 0 se planejado=0)
    repasse_costureira: float = 0.0
    lucro_liquido_dono: float = 0.0
    itens_receita: List[PlanoVsRealizadoItem]
    itens_despesas: List[PlanoVsRealizadoItem]


# ── Movimentações unificadas (legado — mantido para compatibilidade) ─────────
class MovimentacaoItem(BaseModel):
    id: int
    origem: str          # "pedido" | "transacao"
    tipo: str            # "receita" | "despesa"
    descricao: str
    categoria: str
    valor: float
    data: Optional[str]  # YYYY-MM-DD ou None
    icon_key: str

    class Config:
        from_attributes = True


class MovimentacoesResponse(BaseModel):
    mes: str
    total_receitas: float
    total_despesas: float
    saldo: float
    itens: List[MovimentacaoItem]


# ── Pagamentos (nova tabela unificada) ────────────────────────────────────────
class PagamentoItem(BaseModel):
    id: int
    tipo: str            # "receita" | "despesa"
    origem: str          # "pedido" | "despesa_manual"
    descricao: str
    categoria: str
    tipo_item: Optional[str] = None
    detalhe: Optional[str] = None
    cat_raw: Optional[str] = None   # categoria crua do plano_item
    valor: float
    data: str            # YYYY-MM-DD (nunca None)
    icon_key: str
    pedido_id: Optional[int] = None
    plano_item_id: Optional[int] = None
    despesa_id: Optional[int] = None

    class Config:
        from_attributes = True


class PagamentosResponse(BaseModel):
    mes: str
    total_receitas: float
    total_despesas: float
    saldo: float
    itens: List[PagamentoItem]


class PagamentoCreate(BaseModel):
    """Criar despesa manual. Informe plano_item_id OU (tipo_item + categoria)."""
    anomes: str
    plano_item_id: Optional[int] = None
    tipo_item: Optional[str] = None
    detalhe: Optional[str] = None
    categoria: Optional[str] = None   # Custo Fixo | Custo Variável
    data: Optional[str] = None        # YYYY-MM-DD; default = último dia do mês
    valor: float
    descricao: Optional[str] = None


class PagamentoUpdate(BaseModel):
    """Atualizar despesa manual. Receitas não são editáveis aqui."""
    valor: Optional[float] = None
    data: Optional[str] = None
    descricao: Optional[str] = None


# ── Despesas ──────────────────────────────────────────────────────────────────
class DespesaCreate(BaseModel):
    """Lançar despesa realizada. Informe plano_item_id OU (tipo_item + categoria)."""
    anomes: str                          # YYYYMM
    plano_item_id: Optional[int] = None
    tipo_item: Optional[str] = None     # Colaboradores, Espaço Físico…
    detalhe: Optional[str] = None
    categoria: Optional[str] = None     # Custo Fixo | Custo Variável
    data: Optional[str] = None          # YYYY-MM-DD; default = último dia do mês
    valor: float
    descricao: Optional[str] = None


class DespesaUpdate(BaseModel):
    tipo_item: Optional[str] = None
    detalhe: Optional[str] = None
    categoria: Optional[str] = None
    valor: Optional[float] = None
    data: Optional[str] = None
    descricao: Optional[str] = None


class DespesaOut(BaseModel):
    id: int
    anomes: str
    plano_item_id: Optional[int] = None
    tipo_item: str
    detalhe: Optional[str] = None
    categoria: str
    data: str
    valor: float
    descricao: Optional[str] = None

    class Config:
        from_attributes = True


class CobrancaItem(BaseModel):
    id: int
    pedido_id: int
    cliente_nome: str
    tipo_pedido: str
    forma_pagamento: Optional[str] = None
    parcela_numero: Optional[int] = None
    parcela_total: Optional[int] = None
    valor: float
    data_vencimento: Optional[str] = None
    data_pagamento: Optional[str] = None
    status: str  # em_atraso | vence_hoje | a_vencer | pago
    dias_atraso: int = 0


class CobrancasResumo(BaseModel):
    total_em_atraso: float
    count_em_atraso: int
    total_vence_7dias: float
    count_vence_7dias: int
    total_a_vencer: float
    count_a_vencer: int
    total_pago: float
    count_pago: int


class CobrancasResponse(BaseModel):
    em_atraso: List[CobrancaItem]
    vence_hoje: List[CobrancaItem]
    a_vencer: List[CobrancaItem]
    pagas: List[CobrancaItem]
    resumo: CobrancasResumo


class EvolucaoMensalItem(BaseModel):
    anomes: str
    label: str
    receita_planejada: float
    receita_realizada: float


class DashboardResponse(BaseModel):
    plano_vs_realizado: PlanoVsRealizado
    evolucao_mensal: List[EvolucaoMensalItem]
    movimentacoes: PagamentosResponse


class PecaNecessaria(BaseModel):
    tipo_item: str
    ticket_medio: float
    faltam_valor: float
    pecas_necessarias: int
    realizado: float = 0
    realizado_quantidade: int = 0
    realizado_ticket_medio: float = 0


class DespesaNaoLancada(BaseModel):
    tipo_item: str
    detalhe: Optional[str]
    valor_planejado: float


class PecaEntregue(BaseModel):
    tipo: str
    quantidade: int
    valor: float
    ticket_medio: float


class MetaMes(BaseModel):
    anomes: str
    meta_receita: float
    realizado: float
    faltam: float
    percentual: float
    dias_uteis_restantes: int
    pecas_necessarias: List[PecaNecessaria]
    despesas_nao_lancadas: List[DespesaNaoLancada]
    pecas_entregues: List[PecaEntregue]
