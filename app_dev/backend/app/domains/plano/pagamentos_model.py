"""
Modelo Pagamento - tabela unificada de receitas e despesas realizadas.
Receitas: originam de pedidos (parcelas confirmadas pela Ilma).
Despesas: lançamentos manuais com pedido_id=NULL.
"""
from datetime import date, datetime

from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Pagamento(Base):
    """Movimentação financeira realizada (receita ou despesa)."""

    __tablename__ = "pagamentos"

    id              = Column(Integer, primary_key=True, index=True)
    anomes          = Column(String(6), nullable=True, index=True)    # YYYYMM — calculado de data_pagamento
    tipo            = Column(String(10), nullable=False)              # "receita" | "despesa"
    origem          = Column(String(20), nullable=False)              # "pedido" | "despesa_manual" | "repasse_funcionaria" | "taxa_cartao" | "desconto_pix"
    natureza        = Column(String(30), nullable=True, index=True)   # "receita" | "despesa_operacional" | "despesa_financeira"
    subtipo_financeiro = Column(String(20), nullable=True)            # "credito" | "debito" | "pix"
    pedido_id       = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=True)
    plano_item_id   = Column(Integer, ForeignKey("plano_itens.id"), nullable=True)
    parcela_numero  = Column(Integer, nullable=True)                  # 1, 2, 3... / NULL = à vista ou despesa
    parcela_total   = Column(Integer, nullable=True)                  # total de parcelas do pedido
    data_vencimento = Column(Date, nullable=True)                     # quando deveria ser pago
    data_pagamento  = Column(Date, nullable=True)                     # quando foi pago de fato (NULL = pendente)
    taxa_cartao     = Column(Float, nullable=True)                    # % de taxa aplicada nesta parcela
    valor           = Column(Float, nullable=False)
    categoria       = Column(String(100), nullable=True)              # para despesas: Custo Fixo, Custo Variável
    tipo_item       = Column(String(100), nullable=True)              # Pró-Labore, Aluguel, Vestido Noiva...
    descricao       = Column(String(500), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    forma_pagamento       = Column(String(30), nullable=True)   # forma DESTA parcela: Pix, Cartão Parcelado...
    liquidacao_automatica = Column(Boolean, nullable=True)      # parcela de cartão: cai sozinha, não precisa confirmar
    desconto_adiantamento = Column(Float, nullable=True)        # R$ de desconto ao antecipar o recebimento
    pagamento_pai_id      = Column(Integer, nullable=True)      # despesa de custo → parcela que a originou

    pedido     = relationship("Pedido",    back_populates="pagamentos", passive_deletes=True)
    plano_item = relationship("PlanoItem", back_populates="pagamentos")

    @property
    def status(self) -> str:
        """Status calculado com base nas datas.

        Parcela de cartão (liquidação automática) nasce com a data de crédito já
        preenchida, então não faz sentido chamá-la de "confirmada" antes de cair —
        até lá ela é "previsto".
        """
        if self.liquidacao_automatica:
            ref = self.data_pagamento or self.data_vencimento
            return "confirmado" if ref and ref <= date.today() else "previsto"
        if self.data_pagamento is not None:
            return "confirmado"
        if self.data_vencimento and self.data_vencimento < date.today():
            return "em_atraso"
        return "aguardando"

    @property
    def pendente_de_caixa(self) -> bool:
        """True quando o dinheiro ainda não entrou de fato.

        Diferente de `data_pagamento is None`: parcela de cartão futura já tem data
        de pagamento gravada (a data prevista de crédito) mas ainda não caiu.
        """
        if self.liquidacao_automatica:
            ref = self.data_pagamento or self.data_vencimento
            return not (ref and ref <= date.today())
        return self.data_pagamento is None
