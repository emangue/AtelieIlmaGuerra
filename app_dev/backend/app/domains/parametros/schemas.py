"""
Schemas do domínio Parâmetros.
"""
from typing import Optional

from pydantic import BaseModel, Field


class ParametrosOrcamentoSchema(BaseModel):
    preco_hora: float = Field(ge=0, description="Preço por hora (calculado: total_despesas/total_horas_mes)")
    impostos: float = Field(ge=0, le=1, description="Taxa de impostos (ex: 0.06 = 6%)")
    cartao_credito: float = Field(ge=0, le=1, description="Somente leitura: taxa padrão vinda de parametros_taxas")
    total_horas_mes: Optional[float] = None
    margem_target: Optional[float] = Field(None, ge=0, le=1)
    total_despesas: Optional[float] = Field(None, description="Soma das despesas detalhadas (somente leitura)")
    faturamento_target: Optional[float] = Field(None, description="Calculado: total_despesas/(1-impostos-cartao-margem)")


class ParametrosOrcamentoUpdate(BaseModel):
    """Campos editáveis - preco_hora, total_despesas e faturamento_target são calculados.
    cartao_credito saiu daqui de propósito: a taxa é editada em /parametros/taxas."""
    impostos: Optional[float] = Field(None, ge=0, le=1)
    total_horas_mes: Optional[float] = None
    margem_target: Optional[float] = Field(None, ge=0, le=1)


class ParametroTaxaSchema(BaseModel):
    id: int
    forma: str
    canal: Optional[str] = None
    parcelas_min: Optional[int] = None
    parcelas_max: Optional[int] = None
    percentual: float
    tipo_custo: str
    taxa_antecipacao_mes: Optional[float] = None
    padrao: bool
    ativo: bool
    descricao: str = Field(description="Rótulo montado: 'Cartão · Maquininha · 1 a 6x'")
    deflator: float = Field(description="Base 100: quanto sobra de cada R$ 100 passados nessa forma")


class ParametroTaxaCreate(BaseModel):
    forma: str = Field(description='"Cartão" | "Pix"')
    canal: Optional[str] = None
    parcelas_min: Optional[int] = Field(None, ge=1)
    parcelas_max: Optional[int] = Field(None, ge=1)
    percentual: float = Field(ge=0, le=100)
    tipo_custo: str = Field(default="taxa", description='"taxa" | "desconto"')
    taxa_antecipacao_mes: Optional[float] = Field(None, ge=0, le=100)
    padrao: bool = False
    ativo: bool = True


class ParametroTaxaUpdate(BaseModel):
    forma: Optional[str] = None
    canal: Optional[str] = None
    parcelas_min: Optional[int] = Field(None, ge=1)
    parcelas_max: Optional[int] = Field(None, ge=1)
    percentual: Optional[float] = Field(None, ge=0, le=100)
    tipo_custo: Optional[str] = None
    taxa_antecipacao_mes: Optional[float] = Field(None, ge=0, le=100)
    padrao: Optional[bool] = None
    ativo: Optional[bool] = None


class CalcularMargensRequest(BaseModel):
    horas_trabalho: float = Field(ge=0)
    custo_materiais: float = Field(default=0, ge=0)
    custos_variaveis: float = Field(default=0, ge=0)


class CalcularMargensResponse(BaseModel):
    margem_20: float
    margem_30: float
    margem_40: float
    custo_total: float
