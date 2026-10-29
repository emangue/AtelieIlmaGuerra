"""API do acervo e dos aluguéis."""
from datetime import date
import os
from pathlib import Path
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.domains.auth.router import get_user_id_from_token
from app.domains.historico.repository import registrar_alteracao
from app.domains.pedidos.models import Pedido
from app.domains.plano.pagamentos_model import Pagamento
from .models import ItemAcervo, PedidoAcervoItem
from .schemas import AluguelCreate, AluguelDevolucaoInput, AluguelOut, AluguelStatusUpdate, AluguelUpdate, ItemAcervoCreate, ItemAcervoOut, ItemAcervoUpdate, ReceitaAluguelItem
from .service import atualizar_aluguel, carregar, conflito_item, criar_aluguel, mudar_status, serializar

router = APIRouter(
    prefix="/alugueis",
    tags=["Aluguéis"],
    dependencies=[Depends(get_user_id_from_token)],
)
UPLOADS_DIR = Path(__file__).resolve().parents[3] / "uploads" / "acervo"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_BYTES = 8 * 1024 * 1024


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


@router.post("/acervo/upload-foto")
async def upload_foto_acervo(file: UploadFile = File(...), _user_id: int = Depends(get_user_id_from_token)):
    ext = Path(file.filename or "img").suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(422, "Use uma imagem JPG, PNG ou WebP")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Arquivo muito grande. Máximo: 8 MB.")
    name = f"{uuid.uuid4().hex}{ext}"
    (UPLOADS_DIR / name).write_bytes(content)
    base = os.environ.get("BACKEND_URL", "").rstrip("/")
    url = f"{base}/uploads/acervo/{name}" if base else f"/uploads/acervo/{name}"
    return {"url": url}


@router.get("/receitas", response_model=list[ReceitaAluguelItem])
def listar_receitas(mes: str = Query(..., pattern=r"^\d{6}$"), db: Session = Depends(get_db)):
    try:
        ano, num_mes = int(mes[:4]), int(mes[4:])
        inicio = date(ano, num_mes, 1)
        fim = date(ano + 1, 1, 1) if num_mes == 12 else date(ano, num_mes + 1, 1)
    except ValueError:
        raise HTTPException(400, "Mês inválido. Use YYYYMM")
    rows = db.query(Pagamento, Pedido).join(Pedido, Pedido.id == Pagamento.pedido_id).filter(
        Pedido.modalidade == "aluguel", Pagamento.tipo == "receita",
        Pagamento.data_pagamento >= inicio, Pagamento.data_pagamento < fim,
    ).all()
    return [ReceitaAluguelItem(id=p.id, valor_pecas=float(pg.valor), data_entrega=pg.data_pagamento, cliente_nome=p.cliente.nome) for pg, p in rows]


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
    query = db.query(Pedido).options(joinedload(Pedido.cliente), joinedload(Pedido.itens_acervo).joinedload(PedidoAcervoItem.item)).filter(Pedido.modalidade == "aluguel")
    if status:
        query = query.filter(Pedido.status == status)
    elif ativos:
        query = query.filter(Pedido.status.in_(("Reservado", "Retirado")))
    alugueis = query.order_by(Pedido.data_retirada, Pedido.id).all()
    return [serializar(a) for a in alugueis]


@router.post("", response_model=AluguelOut, status_code=201)
def criar(data: AluguelCreate, db: Session = Depends(get_db), user_id: int = Depends(get_user_id_from_token)):
    pedido = criar_aluguel(db, data)
    registrar_alteracao(db, user_id=user_id, entidade="pedido", entidade_id=pedido.id, acao="criou", resumo=f"Aluguel #{pedido.id} criado")
    db.commit()
    return serializar(carregar(db, pedido.id))


@router.get("/{aluguel_id}", response_model=AluguelOut)
def obter(aluguel_id: int, db: Session = Depends(get_db)):
    aluguel = carregar(db, aluguel_id)
    if not aluguel:
        raise HTTPException(404, "Aluguel não encontrado")
    return serializar(aluguel)


@router.patch("/{aluguel_id}", response_model=AluguelOut)
def atualizar(aluguel_id: int, data: AluguelUpdate, db: Session = Depends(get_db), user_id: int = Depends(get_user_id_from_token)):
    aluguel = carregar(db, aluguel_id)
    if not aluguel:
        raise HTTPException(404, "Aluguel não encontrado")
    atualizar_aluguel(db, aluguel, data)
    registrar_alteracao(db, user_id=user_id, entidade="pedido", entidade_id=aluguel_id, acao="editou", resumo="Aluguel atualizado")
    db.commit()
    return serializar(carregar(db, aluguel_id))


@router.patch("/{aluguel_id}/status", response_model=AluguelOut)
def atualizar_status(aluguel_id: int, data: AluguelStatusUpdate, db: Session = Depends(get_db), user_id: int = Depends(get_user_id_from_token)):
    aluguel = carregar(db, aluguel_id)
    if not aluguel:
        raise HTTPException(404, "Aluguel não encontrado")
    anterior = aluguel.status
    mudar_status(db, aluguel, data.status, data.data_evento)
    registrar_alteracao(db, user_id=user_id, entidade="pedido", entidade_id=aluguel_id, acao="mudou_status", resumo=f"Aluguel: {anterior} → {data.status}")
    db.commit()
    return serializar(carregar(db, aluguel_id))


@router.post("/{aluguel_id}/devolucao", response_model=AluguelOut)
def registrar_devolucao(aluguel_id: int, data: AluguelDevolucaoInput, db: Session = Depends(get_db), user_id: int = Depends(get_user_id_from_token)):
    aluguel = carregar(db, aluguel_id)
    if not aluguel:
        raise HTTPException(404, "Aluguel não encontrado")
    if aluguel.status != "Retirado":
        raise HTTPException(400, "Somente um aluguel retirado pode ser devolvido")
    por_item = {item.item_acervo_id: item for item in aluguel.itens_acervo}
    if set(por_item) != {item.item_acervo_id for item in data.itens}:
        raise HTTPException(400, "Informe a conferência de todos os itens do aluguel")
    for recebido in data.itens:
        relacao = por_item[recebido.item_acervo_id]
        relacao.observacao_devolucao = recebido.observacao_devolucao
        relacao.valor_dano = recebido.valor_dano
    if data.status_caucao:
        aluguel.status_caucao = data.status_caucao
    mudar_status(db, aluguel, "Devolvido", data.data_evento, conferencia_realizada=True)
    registrar_alteracao(db, user_id=user_id, entidade="pedido", entidade_id=aluguel_id, acao="devolveu", resumo="Aluguel devolvido e itens conferidos")
    db.commit()
    return serializar(carregar(db, aluguel_id))
