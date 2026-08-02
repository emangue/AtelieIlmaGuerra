"""
Modelo ParametrosOrcamento - configurações para cálculo de margens.
Modelo ParametroTaxa - custo de receber por forma de pagamento, canal e prazo.
"""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Float

from app.core.database import Base


class ParametrosOrcamento(Base):
    """Parâmetros globais para orçamento (1 registro)."""

    __tablename__ = "parametros_orcamento"

    id = Column(Integer, primary_key=True, index=True)
    preco_hora = Column(Float, nullable=False, default=50.0)
    impostos = Column(Float, nullable=False, default=0.06)
    # Legado: fallback de último recurso e snapshot histórico dos pedidos.
    # A fonte da verdade da taxa é parametros_taxas — ver domains/parametros/taxas.py.
    cartao_credito = Column(Float, nullable=False, default=0.03)
    total_horas_mes = Column(Float, nullable=True)
    margem_target = Column(Float, nullable=True, default=0.25)


class ParametroTaxa(Base):
    """Custo de receber por forma de pagamento, canal e faixa de parcelas.

    Uma linha por combinação: "Pix" (desconto de 5%), "Cartão · Maquininha · 1-6x",
    "Cartão · Link de pagamento · 7-12x" etc.
    """

    __tablename__ = "parametros_taxas"

    id                   = Column(Integer, primary_key=True, index=True)
    forma                = Column(String(30), nullable=False, index=True)  # "Cartão" | "Pix"
    canal                = Column(String(20), nullable=True)               # "Maquininha" | "Link de pagamento" | NULL
    parcelas_min         = Column(Integer, nullable=True)                  # NULL quando não se aplica (Pix)
    parcelas_max         = Column(Integer, nullable=True)
    percentual           = Column(Float, nullable=False, default=0.0)      # % sobre o valor pago nessa forma
    tipo_custo           = Column(String(20), nullable=False, default="taxa")  # "taxa" | "desconto"
    taxa_antecipacao_mes = Column(Float, nullable=True)                    # % a.m. para valor presente (Passo 2)
    padrao               = Column(Boolean, nullable=False, default=False)  # usada no preço sugerido / faturamento_target
    ativo                = Column(Boolean, nullable=False, default=True)
    updated_at           = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def deflator(self) -> float:
        """Deflator base 100: quanto sobra de cada 100 reais passados nessa forma."""
        return round(100.0 - (self.percentual or 0.0), 4)

    @property
    def descricao(self) -> str:
        partes = [self.forma]
        if self.canal:
            partes.append(self.canal)
        if self.parcelas_min or self.parcelas_max:
            lo, hi = self.parcelas_min or 1, self.parcelas_max or self.parcelas_min or 1
            partes.append(f"{lo}x" if lo == hi else f"{lo} a {hi}x")
        return " · ".join(partes)
