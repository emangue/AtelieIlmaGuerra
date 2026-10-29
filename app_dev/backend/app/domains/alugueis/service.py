"""Regras do aluguel integrado ao domínio de Pedidos."""
from datetime import date
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.domains.clientes.models import Cliente
from app.domains.pedidos.models import Pedido
from app.domains.plano.pagamentos_model import Pagamento
from .models import ItemAcervo, PedidoAcervoItem
from .schemas import AluguelCreate, AluguelItemInput, AluguelOut, AluguelItemOut, AluguelUpdate

STATUS_BLOQUEIAM = ("Reservado", "Retirado")

def conflito_item(db: Session, item_id: int, inicio: date, fim: date, ignorar_pedido_id: Optional[int] = None) -> bool:
    query = db.query(Pedido.id).join(PedidoAcervoItem).filter(
        PedidoAcervoItem.item_acervo_id == item_id, Pedido.modalidade == "aluguel",
        Pedido.status.in_(STATUS_BLOQUEIAM), Pedido.data_retirada <= fim,
        Pedido.data_devolucao_prevista >= inicio,
    )
    if ignorar_pedido_id is not None:
        query = query.filter(Pedido.id != ignorar_pedido_id)
    return query.first() is not None

def _validar_itens(db: Session, itens: list[AluguelItemInput], inicio: date, fim: date, ignorar: Optional[int] = None):
    ids = [i.item_acervo_id for i in itens]
    encontrados = db.query(ItemAcervo).filter(
        ItemAcervo.id.in_(ids), ItemAcervo.ativo.is_(True), ItemAcervo.status_item == "disponivel"
    ).all()
    if len(encontrados) != len(set(ids)):
        raise HTTPException(400, "Um ou mais itens não existem, estão inativos ou em manutenção")
    ocupados = [item.codigo for item in encontrados if conflito_item(db, item.id, inicio, fim, ignorar)]
    if ocupados:
        raise HTTPException(409, f"Itens indisponíveis no período: {', '.join(sorted(ocupados))}")

def criar_aluguel(db: Session, data: AluguelCreate) -> Pedido:
    cliente = db.query(Cliente).filter(Cliente.id == data.cliente_id).first()
    if not cliente:
        raise HTTPException(400, "Cliente não encontrado")
    _validar_itens(db, data.itens, data.data_retirada, data.data_devolucao_prevista)
    itens_db = db.query(ItemAcervo).filter(ItemAcervo.id.in_([i.item_acervo_id for i in data.itens])).all()
    nomes = {i.id: i.nome for i in itens_db}
    total = sum(i.valor_aluguel for i in data.itens)
    pedido = Pedido(
        cliente_id=data.cliente_id, modalidade="aluguel", data_pedido=data.data_reserva,
        data_entrega=data.data_retirada, data_retirada=data.data_retirada,
        data_devolucao_prevista=data.data_devolucao_prevista, status="Reservado",
        descricao_produto=", ".join(nomes.get(i.item_acervo_id, str(i.item_acervo_id)) for i in data.itens),
        valor_pecas=total, quantidade_pecas=len(data.itens), horas_trabalho=0, custo_materiais=0,
        valor_caucao=data.valor_caucao,
        status_caucao="pendente" if data.valor_caucao > 0 else "nao_aplicavel",
        forma_pagamento=data.forma_pagamento, observacao_pedido=data.observacao,
        criado_como_orcamento=False, percentual_lucro_dono=100,
    )
    pedido.itens_acervo = [PedidoAcervoItem(item_acervo_id=i.item_acervo_id, valor_aluguel=i.valor_aluguel) for i in data.itens]
    db.add(pedido)
    db.flush()
    if total > 0:
        db.add(Pagamento(
            anomes=f"{data.data_retirada.year}{data.data_retirada.month:02d}", tipo="receita",
            origem="pedido", natureza="receita", pedido_id=pedido.id, parcela_numero=1,
            parcela_total=1, data_vencimento=data.data_retirada, data_pagamento=None, valor=total,
            tipo_item="Aluguel", descricao=f"Aluguel · {cliente.nome}",
            forma_pagamento=data.forma_pagamento, liquidacao_automatica=False,
        ))
    db.commit()
    return carregar(db, pedido.id)

def atualizar_aluguel(db: Session, pedido: Pedido, data: AluguelUpdate) -> Pedido:
    if pedido.status != "Reservado":
        permitidos = {"status_caucao", "observacao"}
        if set(data.model_dump(exclude_unset=True)) - permitidos:
            raise HTTPException(400, "Somente reservas podem ter período ou itens alterados")
    inicio = data.data_retirada or pedido.data_retirada
    fim = data.data_devolucao_prevista or pedido.data_devolucao_prevista
    if fim < inicio:
        raise HTTPException(400, "A devolução deve ser igual ou posterior à retirada")
    itens = data.itens or [AluguelItemInput(item_acervo_id=i.item_acervo_id, valor_aluguel=i.valor_aluguel) for i in pedido.itens_acervo]
    if len({i.item_acervo_id for i in itens}) != len(itens):
        raise HTTPException(400, "Um item do acervo não pode ser repetido")
    _validar_itens(db, itens, inicio, fim, pedido.id)
    mapping = {"data_retirada":"data_retirada", "data_devolucao_prevista":"data_devolucao_prevista",
               "valor_caucao":"valor_caucao", "forma_pagamento":"forma_pagamento",
               "observacao":"observacao_pedido", "status_caucao":"status_caucao"}
    for key, value in data.model_dump(exclude_unset=True, exclude={"itens"}).items():
        setattr(pedido, mapping[key], value)
    if data.itens is not None:
        existentes = {rel.item_acervo_id: rel for rel in pedido.itens_acervo}
        ids_novos = {item.item_acervo_id for item in itens}
        for relacao in list(pedido.itens_acervo):
            if relacao.item_acervo_id not in ids_novos:
                pedido.itens_acervo.remove(relacao)
        for item in itens:
            if item.item_acervo_id in existentes:
                existentes[item.item_acervo_id].valor_aluguel = item.valor_aluguel
            else:
                pedido.itens_acervo.append(PedidoAcervoItem(item_acervo_id=item.item_acervo_id, valor_aluguel=item.valor_aluguel))
    pedido.valor_pecas = sum(i.valor_aluguel for i in itens)
    pedido.quantidade_pecas = len(itens)
    pedido.data_entrega = pedido.data_retirada
    for pagamento in [p for p in pedido.pagamentos if p.tipo == "receita" and p.pendente_de_caixa]:
        pagamento.valor = pedido.valor_pecas
        pagamento.data_vencimento = pedido.data_retirada
        pagamento.forma_pagamento = pedido.forma_pagamento
        pagamento.anomes = f"{pedido.data_retirada.year}{pedido.data_retirada.month:02d}"
    db.commit()
    return carregar(db, pedido.id)

def mudar_status(db: Session, pedido: Pedido, status: str, data_evento: Optional[date], conferencia_realizada: bool = False) -> Pedido:
    transicoes = {"Reservado":{"Retirado","Cancelado"}, "Retirado":{"Devolvido"}, "Devolvido":set(), "Cancelado":set()}
    if status == pedido.status:
        return pedido
    if status not in transicoes.get(pedido.status, set()):
        raise HTTPException(400, f"Transição inválida: {pedido.status} para {status}")
    if status == "Devolvido" and not conferencia_realizada:
        raise HTTPException(400, "Registre a conferência dos itens antes de concluir a devolução")
    evento = data_evento or date.today()
    if status == "Retirado":
        if evento < pedido.data_pedido:
            raise HTTPException(400, "A retirada real não pode anteceder a reserva")
        pedido.data_retirada_real = evento
    elif status == "Devolvido":
        if pedido.data_retirada_real and evento < pedido.data_retirada_real:
            raise HTTPException(400, "A devolução real não pode anteceder a retirada")
        pedido.data_devolucao_real = evento
    elif status == "Cancelado":
        for pagamento in list(pedido.pagamentos):
            if pagamento.tipo == "receita" and pagamento.pendente_de_caixa:
                db.delete(pagamento)
    pedido.status = status
    db.commit()
    return carregar(db, pedido.id)

def carregar(db: Session, pedido_id: int) -> Optional[Pedido]:
    return db.query(Pedido).options(
        joinedload(Pedido.cliente), joinedload(Pedido.itens_acervo).joinedload(PedidoAcervoItem.item),
        joinedload(Pedido.pagamentos),
    ).filter(Pedido.id == pedido_id, Pedido.modalidade == "aluguel").first()

def alerta_do_pedido(pedido: Pedido) -> Optional[str]:
    hoje = date.today()
    if pedido.status == "Reservado":
        dias = (pedido.data_retirada - hoje).days
        if dias < 0: return f"Retirada atrasada há {abs(dias)} dia(s)"
        if dias == 0: return "Retirada hoje"
        if dias == 1: return "Retirada amanhã"
    if pedido.status == "Retirado":
        dias = (pedido.data_devolucao_prevista - hoje).days
        if dias < 0: return f"Devolução atrasada há {abs(dias)} dia(s)"
        if dias == 0: return "Devolução hoje"
        if dias == 1: return "Devolução amanhã"
    return None

def serializar(pedido: Pedido) -> AluguelOut:
    return AluguelOut(
        id=pedido.id, cliente_id=pedido.cliente_id, cliente_nome=pedido.cliente.nome,
        data_reserva=pedido.data_pedido, data_retirada=pedido.data_retirada,
        data_devolucao_prevista=pedido.data_devolucao_prevista,
        data_retirada_real=pedido.data_retirada_real, data_devolucao_real=pedido.data_devolucao_real,
        status=pedido.status, valor_total=float(pedido.valor_pecas or 0), valor_caucao=float(pedido.valor_caucao or 0),
        status_caucao=pedido.status_caucao or "nao_aplicavel", forma_pagamento=pedido.forma_pagamento,
        observacao=pedido.observacao_pedido,
        itens=[AluguelItemOut(item_acervo_id=i.item_acervo_id, codigo=i.item.codigo, nome=i.item.nome,
            categoria=i.item.categoria, valor_aluguel=float(i.valor_aluguel), foto_url=i.item.foto_url,
            observacao_retirada=i.observacao_retirada, observacao_devolucao=i.observacao_devolucao,
            valor_dano=i.valor_dano) for i in pedido.itens_acervo],
        created_at=pedido.created_at, updated_at=pedido.updated_at, alerta=alerta_do_pedido(pedido),
    )
