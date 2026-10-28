"""Regras de disponibilidade e ciclo do aluguel."""
from datetime import date
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.domains.clientes.models import Cliente
from .models import Aluguel, AluguelItem, ItemAcervo
from .schemas import AluguelCreate, AluguelItemInput, AluguelOut, AluguelItemOut, AluguelUpdate


STATUS_BLOQUEIAM = ("Reservado", "Retirado")


def conflito_item(db: Session, item_id: int, inicio: date, fim: date, ignorar_aluguel_id: Optional[int] = None) -> bool:
    query = (
        db.query(Aluguel.id)
        .join(AluguelItem)
        .filter(
            AluguelItem.item_acervo_id == item_id,
            Aluguel.status.in_(STATUS_BLOQUEIAM),
            Aluguel.data_retirada <= fim,
            Aluguel.data_devolucao_prevista >= inicio,
        )
    )
    if ignorar_aluguel_id is not None:
        query = query.filter(Aluguel.id != ignorar_aluguel_id)
    return query.first() is not None


def _validar_itens(db: Session, itens: list[AluguelItemInput], inicio: date, fim: date, ignorar: Optional[int] = None):
    ids = [i.item_acervo_id for i in itens]
    encontrados = db.query(ItemAcervo).filter(ItemAcervo.id.in_(ids), ItemAcervo.ativo.is_(True)).all()
    if len(encontrados) != len(set(ids)):
        raise HTTPException(400, "Um ou mais itens do acervo não existem ou estão inativos")
    ocupados = [item.codigo for item in encontrados if conflito_item(db, item.id, inicio, fim, ignorar)]
    if ocupados:
        raise HTTPException(409, f"Itens indisponíveis no período: {', '.join(sorted(ocupados))}")


def criar_aluguel(db: Session, data: AluguelCreate) -> Aluguel:
    if not db.query(Cliente.id).filter(Cliente.id == data.cliente_id).first():
        raise HTTPException(400, "Cliente não encontrado")
    _validar_itens(db, data.itens, data.data_retirada, data.data_devolucao_prevista)
    aluguel = Aluguel(
        cliente_id=data.cliente_id, data_reserva=data.data_reserva,
        data_retirada=data.data_retirada, data_devolucao_prevista=data.data_devolucao_prevista,
        valor_total=sum(i.valor_aluguel for i in data.itens), valor_caucao=data.valor_caucao,
        forma_pagamento=data.forma_pagamento, observacao=data.observacao,
    )
    aluguel.itens = [AluguelItem(item_acervo_id=i.item_acervo_id, valor_aluguel=i.valor_aluguel) for i in data.itens]
    db.add(aluguel)
    db.commit()
    db.refresh(aluguel)
    return aluguel


def atualizar_aluguel(db: Session, aluguel: Aluguel, data: AluguelUpdate) -> Aluguel:
    if aluguel.status != "Reservado":
        raise HTTPException(400, "Somente reservas podem ter período ou itens alterados")
    inicio = data.data_retirada or aluguel.data_retirada
    fim = data.data_devolucao_prevista or aluguel.data_devolucao_prevista
    if fim < inicio:
        raise HTTPException(400, "A devolução deve ser igual ou posterior à retirada")
    itens = data.itens or [AluguelItemInput(item_acervo_id=i.item_acervo_id, valor_aluguel=i.valor_aluguel) for i in aluguel.itens]
    if len({i.item_acervo_id for i in itens}) != len(itens):
        raise HTTPException(400, "Um item do acervo não pode ser repetido")
    _validar_itens(db, itens, inicio, fim, aluguel.id)
    payload = data.model_dump(exclude_unset=True, exclude={"itens"})
    for key, value in payload.items():
        setattr(aluguel, key, value)
    if data.itens is not None:
        aluguel.itens = [AluguelItem(item_acervo_id=i.item_acervo_id, valor_aluguel=i.valor_aluguel) for i in itens]
    aluguel.valor_total = sum(i.valor_aluguel for i in itens)
    db.commit()
    db.refresh(aluguel)
    return aluguel


def mudar_status(db: Session, aluguel: Aluguel, status: str, data_evento: Optional[date]) -> Aluguel:
    transicoes = {
        "Reservado": {"Retirado", "Cancelado"},
        "Retirado": {"Devolvido"},
        "Devolvido": set(), "Cancelado": set(),
    }
    if status == aluguel.status:
        return aluguel
    if status not in transicoes.get(aluguel.status, set()):
        raise HTTPException(400, f"Transição inválida: {aluguel.status} para {status}")
    evento = data_evento or date.today()
    if status == "Retirado":
        if evento < aluguel.data_reserva:
            raise HTTPException(400, "A retirada real não pode anteceder a reserva")
        if evento > aluguel.data_devolucao_prevista:
            raise HTTPException(400, "A retirada real não pode ser posterior à devolução prevista; ajuste o período da reserva")
        aluguel.data_retirada_real = evento
    elif status == "Devolvido":
        if aluguel.data_retirada_real and evento < aluguel.data_retirada_real:
            raise HTTPException(400, "A devolução real não pode anteceder a retirada")
        aluguel.data_devolucao_real = evento
    aluguel.status = status
    db.commit()
    db.refresh(aluguel)
    return aluguel


def carregar(db: Session, aluguel_id: int) -> Optional[Aluguel]:
    return db.query(Aluguel).options(joinedload(Aluguel.cliente), joinedload(Aluguel.itens).joinedload(AluguelItem.item)).filter(Aluguel.id == aluguel_id).first()


def serializar(aluguel: Aluguel) -> AluguelOut:
    return AluguelOut(
        id=aluguel.id, cliente_id=aluguel.cliente_id, cliente_nome=aluguel.cliente.nome,
        data_reserva=aluguel.data_reserva, data_retirada=aluguel.data_retirada,
        data_devolucao_prevista=aluguel.data_devolucao_prevista,
        data_retirada_real=aluguel.data_retirada_real, data_devolucao_real=aluguel.data_devolucao_real,
        status=aluguel.status, valor_total=float(aluguel.valor_total or 0), valor_caucao=float(aluguel.valor_caucao or 0),
        forma_pagamento=aluguel.forma_pagamento, observacao=aluguel.observacao,
        itens=[AluguelItemOut(item_acervo_id=i.item_acervo_id, codigo=i.item.codigo, nome=i.item.nome, categoria=i.item.categoria, valor_aluguel=float(i.valor_aluguel)) for i in aluguel.itens],
        created_at=aluguel.created_at, updated_at=aluguel.updated_at,
    )
