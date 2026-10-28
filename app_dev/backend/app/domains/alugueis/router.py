"""API do acervo e dos aluguéis."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.domains.auth.router import get_user_id_from_token
from .models import Aluguel, AluguelItem, ItemAcervo
from .schemas import AluguelCreate, AluguelOut, AluguelStatusUpdate, AluguelUpdate, ItemAcervoCreate, ItemAcervoOut, ItemAcervoUpdate, ReceitaAluguelItem
from .service import atualizar_aluguel, carregar, conflito_item, criar_aluguel, mudar_status, serializar

router = APIRouter(
    prefix="/alugueis",
    tags=["Aluguéis"],
    dependencies=[Depends(get_user_id_from_token)],
)


@router.get("/acervo", response_model=list[ItemAcervoOut])
def listar_acervo(data_retirada: Optional[date] = None, data_devolucao: Optional[date] = None, incluir_inativos: bool = False, db: Session = Depends(get_db)):
    if (data_retirada is None) != (data_devolucao is None):
        raise HTTPException(400, "Informe as duas datas para consultar disponibilidade")
    if data_retirada and data_devolucao and data_devolucao < data_retirada:
        raise HTTPException(400, "Período inválido")
    query = db.query(ItemAcervo).order_by(ItemAcervo.categoria, ItemAcervo.nome)
    if not incluir_inativos:
        query = query.filter(ItemAcervo.ativo.is_(True))
    return [ItemAcervoOut.model_validate(i).model_copy(update={"disponivel": not conflito_item(db, i.id, data_retirada, data_devolucao) if data_retirada else None}) for i in query.all()]


@router.post("/acervo", response_model=ItemAcervoOut, status_code=201)
def criar_item(data: ItemAcervoCreate, db: Session = Depends(get_db)):
    item = ItemAcervo(**data.model_dump())
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Já existe um item com este código")
    db.refresh(item)
    return item


@router.get("/receitas", response_model=list[ReceitaAluguelItem])
def listar_receitas(mes: str = Query(..., pattern=r"^\d{6}$"), db: Session = Depends(get_db)):
    try:
        ano, num_mes = int(mes[:4]), int(mes[4:])
        inicio = date(ano, num_mes, 1)
        fim = date(ano + 1, 1, 1) if num_mes == 12 else date(ano, num_mes + 1, 1)
    except ValueError:
        raise HTTPException(400, "Mês inválido. Use YYYYMM")
    rows = (
        db.query(Aluguel).options(joinedload(Aluguel.cliente))
        .filter(Aluguel.status.in_(("Retirado", "Devolvido")), Aluguel.data_retirada_real >= inicio, Aluguel.data_retirada_real < fim)
        .order_by(Aluguel.data_retirada_real, Aluguel.id).all()
    )
    return [ReceitaAluguelItem(id=a.id, valor_pecas=float(a.valor_total), data_entrega=a.data_retirada_real, cliente_nome=a.cliente.nome) for a in rows]


@router.patch("/acervo/{item_id}", response_model=ItemAcervoOut)
def atualizar_item(item_id: int, data: ItemAcervoUpdate, db: Session = Depends(get_db)):
    item = db.query(ItemAcervo).filter(ItemAcervo.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item do acervo não encontrado")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Já existe um item com este código")
    db.refresh(item)
    return item


@router.get("", response_model=list[AluguelOut])
def listar_alugueis(status: Optional[str] = None, ativos: bool = False, db: Session = Depends(get_db)):
    query = db.query(Aluguel).options(joinedload(Aluguel.cliente), joinedload(Aluguel.itens).joinedload(AluguelItem.item))
    if status:
        query = query.filter(Aluguel.status == status)
    elif ativos:
        query = query.filter(Aluguel.status.in_(("Reservado", "Retirado")))
    alugueis = query.order_by(Aluguel.data_retirada, Aluguel.id).all()
    return [serializar(a) for a in alugueis]


@router.post("", response_model=AluguelOut, status_code=201)
def criar(data: AluguelCreate, db: Session = Depends(get_db)):
    return serializar(carregar(db, criar_aluguel(db, data).id))


@router.get("/{aluguel_id}", response_model=AluguelOut)
def obter(aluguel_id: int, db: Session = Depends(get_db)):
    aluguel = carregar(db, aluguel_id)
    if not aluguel:
        raise HTTPException(404, "Aluguel não encontrado")
    return serializar(aluguel)


@router.patch("/{aluguel_id}", response_model=AluguelOut)
def atualizar(aluguel_id: int, data: AluguelUpdate, db: Session = Depends(get_db)):
    aluguel = carregar(db, aluguel_id)
    if not aluguel:
        raise HTTPException(404, "Aluguel não encontrado")
    atualizar_aluguel(db, aluguel, data)
    return serializar(carregar(db, aluguel_id))


@router.patch("/{aluguel_id}/status", response_model=AluguelOut)
def atualizar_status(aluguel_id: int, data: AluguelStatusUpdate, db: Session = Depends(get_db)):
    aluguel = carregar(db, aluguel_id)
    if not aluguel:
        raise HTTPException(404, "Aluguel não encontrado")
    mudar_status(db, aluguel, data.status, data.data_evento)
    return serializar(carregar(db, aluguel_id))
