"""Testes das regras de maior risco do fluxo de aluguéis."""
import unittest
from datetime import date

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.domains.alugueis.models import Aluguel, AluguelItem, ItemAcervo  # noqa: F401
from app.domains.alugueis.schemas import AluguelCreate
from app.domains.alugueis.service import criar_aluguel, mudar_status
from app.domains.clientes.models import Cliente
from app.domains.pedidos.models import FormaPeca, FormaPecaMedida, Pedido, TipoPedido, tipo_pedido_forma_peca  # noqa: F401
from app.domains.plano.models import PlanoItem  # noqa: F401
from app.domains.plano.pagamentos_model import Pagamento  # noqa: F401
from app.domains.plano.service import get_plano_vs_realizado


class AlugueisTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        cliente = Cliente(nome="Cliente Teste")
        item = ItemAcervo(codigo="V001", nome="Vestido azul", categoria="Vestido", ativo=True)
        self.db.add_all([cliente, item])
        self.db.commit()
        self.cliente_id, self.item_id = cliente.id, item.id

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def payload(self, inicio=date(2026, 9, 20), fim=date(2026, 9, 22)):
        return AluguelCreate(
            cliente_id=self.cliente_id,
            data_reserva=date(2026, 9, 1),
            data_retirada=inicio,
            data_devolucao_prevista=fim,
            itens=[{"item_acervo_id": self.item_id, "valor_aluguel": 500}],
            valor_caucao=200,
        )

    def test_bloqueia_periodos_sobrepostos_e_permite_apos_cancelamento(self):
        primeiro = criar_aluguel(self.db, self.payload())
        with self.assertRaises(HTTPException) as erro:
            criar_aluguel(self.db, self.payload(date(2026, 9, 22), date(2026, 9, 23)))
        self.assertEqual(erro.exception.status_code, 409)

        mudar_status(self.db, primeiro, "Cancelado", None)
        segundo = criar_aluguel(self.db, self.payload(date(2026, 9, 22), date(2026, 9, 23)))
        self.assertEqual(segundo.valor_total, 500)

    def test_receita_so_e_reconhecida_na_retirada_e_caucao_nao_entra(self):
        aluguel = criar_aluguel(self.db, self.payload())
        antes = get_plano_vs_realizado(self.db, "202609")
        self.assertEqual(antes.receita_realizada, 0)

        mudar_status(self.db, aluguel, "Retirado", date(2026, 9, 20))
        depois = get_plano_vs_realizado(self.db, "202609")
        self.assertEqual(depois.receita_realizada, 500)
        self.assertEqual(depois.itens_receita[0].tipo_item, "Aluguel")

    def test_devolucao_nao_pode_anteceder_retirada(self):
        aluguel = criar_aluguel(self.db, self.payload())
        mudar_status(self.db, aluguel, "Retirado", date(2026, 9, 21))
        with self.assertRaises(HTTPException) as erro:
            mudar_status(self.db, aluguel, "Devolvido", date(2026, 9, 20))
        self.assertEqual(erro.exception.status_code, 400)

    def test_retirada_atrasada_exige_ajuste_do_periodo(self):
        aluguel = criar_aluguel(self.db, self.payload())
        with self.assertRaises(HTTPException) as erro:
            mudar_status(self.db, aluguel, "Retirado", date(2026, 9, 23))
        self.assertEqual(erro.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
