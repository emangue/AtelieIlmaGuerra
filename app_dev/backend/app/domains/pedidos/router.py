"""
Router do domínio Pedidos.
"""
import os
import uuid
from datetime import date
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile

from app.core.database import get_db
from sqlalchemy.orm import Session

from .schemas import PedidoCreate, PedidoUpdate, PedidoStatusUpdate, PedidoListItem, PedidoDetail, TipoPedidoItem, FormaPecaItem
from .service import PedidoService, _norm_foto_url
from .models import FormaPeca, FormaPecaMedida

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads"
(UPLOADS_DIR / "pedidos").mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/pedidos", tags=["Pedidos"])


@router.get("/todos", response_model=List[PedidoListItem])
def list_pedidos_todos(
    mes: Optional[str] = Query(None, description="YYYYMM - filtra por data_entrega no mês"),
    db: Session = Depends(get_db),
):
    """Lista todos os pedidos. Use mes=YYYYMM para filtrar por mês de entrega."""
    service = PedidoService(db)
    pedidos = service.list_all(mes=mes)
    return [service.to_list_item(p) for p in pedidos]


@router.get("/ativos", response_model=List[PedidoListItem])
def list_pedidos_ativos(
    excluir: Optional[str] = Query(None, description="Status a excluir, separados por vírgula (ex: entregue,orcamento)"),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Lista pedidos ativos (exclui Entregue e Orçamento por padrão)."""
    service = PedidoService(db)
    excluir_list = None
    if excluir:
        excluir_list = [s.strip() for s in excluir.split(",") if s.strip()]
    pedidos = service.list_ativos(
        excluir_status=excluir_list,
        data_inicio=data_inicio,
        data_fim=data_fim,
    )
    return [service.to_list_item(p) for p in pedidos]


@router.get("/tipos", response_model=List[TipoPedidoItem])
def list_tipos_pedido(db: Session = Depends(get_db)):
    """Lista tipos de pedido (catálogo)."""
    service = PedidoService(db)
    tipos = service.list_tipos()
    return [TipoPedidoItem(id=t.id, nome=t.nome) for t in tipos]


@router.get("/formas-peca", response_model=List[FormaPecaItem])
def list_formas_peca(
    tipo_pedido_id: Optional[int] = Query(None, description="Filtra formas válidas para este tipo de pedido"),
    db: Session = Depends(get_db),
):
    """Lista formas de peça. Se tipo_pedido_id for informado, retorna apenas as formas válidas para esse tipo."""
    from .models import TipoPedido, tipo_pedido_forma_peca

    if tipo_pedido_id:
        # Formas associadas a este tipo de pedido
        formas = (
            db.query(FormaPeca)
            .join(tipo_pedido_forma_peca, FormaPeca.id == tipo_pedido_forma_peca.c.forma_peca_id)
            .filter(tipo_pedido_forma_peca.c.tipo_pedido_id == tipo_pedido_id)
            .order_by(FormaPeca.nome)
            .all()
        )
    else:
        formas = db.query(FormaPeca).order_by(FormaPeca.nome).all()

    result = []
    for fp in formas:
        medidas = (
            db.query(FormaPecaMedida.medida_key)
            .filter(FormaPecaMedida.forma_peca_id == fp.id)
            .all()
        )
        result.append(
            FormaPecaItem(
                id=fp.id,
                nome=fp.nome,
                medidas=[m[0] for m in medidas],
            )
        )
    return result


@router.post("/upload-foto")
async def upload_foto_pedido(file: UploadFile):
    """Recebe foto, salva em uploads/pedidos e retorna a URL."""
    ext = Path(file.filename or "img").suffix or ".jpg"
    if ext.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    path = UPLOADS_DIR / "pedidos" / name
    content = await file.read()
    path.write_bytes(content)
    # URL relativa: funciona em prod (mesmo domínio) e dev (rewrite)
    base = os.environ.get("BACKEND_URL", "").rstrip("/")
    url = f"{base}/uploads/pedidos/{name}" if base else f"/uploads/pedidos/{name}"
    return {"url": url}


@router.post("", response_model=PedidoListItem, status_code=201)
def create_pedido(data: PedidoCreate, db: Session = Depends(get_db)):
    """Cria novo pedido."""
    service = PedidoService(db)
    pedido = service.create(data)
    return service.to_list_item(pedido)


@router.get("/{pedido_id}", response_model=PedidoDetail)
def get_pedido(pedido_id: int, db: Session = Depends(get_db)):
    """Retorna detalhes de um pedido."""
    service = PedidoService(db)
    pedido = service.get_by_id(pedido_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    item = service.to_list_item(pedido)
    return PedidoDetail(
        **item.model_dump(),
        forma_peca_id=pedido.forma_peca_id,
        forma_peca_nome=pedido.forma_peca.nome if pedido.forma_peca else None,
        valor_pecas=pedido.valor_pecas,
        quantidade_pecas=pedido.quantidade_pecas,
        horas_trabalho=pedido.horas_trabalho,
        custo_materiais=pedido.custo_materiais,
        custos_variaveis=pedido.custos_variaveis,
        margem_real=pedido.margem_real,
        forma_pagamento=pedido.forma_pagamento,
        valor_entrada=pedido.valor_entrada,
        valor_restante=pedido.valor_restante,
        detalhes_pagamento=pedido.detalhes_pagamento,
        medidas_disponiveis=pedido.medidas_disponiveis,
        fotos_disponiveis=getattr(pedido, "fotos_disponiveis", None),
        medida_ombro=pedido.medida_ombro,
        medida_busto=pedido.medida_busto,
        medida_cinto=pedido.medida_cinto,
        medida_quadril=getattr(pedido, "medida_quadril", None),
        medida_comprimento_corpo=getattr(pedido, "medida_comprimento_corpo", None),
        medida_comprimento_vestido=getattr(pedido, "medida_comprimento_vestido", None),
        medida_distancia_busto=getattr(pedido, "medida_distancia_busto", None),
        medida_raio_busto=getattr(pedido, "medida_raio_busto", None),
        medida_altura_busto=getattr(pedido, "medida_altura_busto", None),
        medida_frente=getattr(pedido, "medida_frente", None),
        medida_costado=getattr(pedido, "medida_costado", None),
        medida_comprimento_calca=getattr(pedido, "medida_comprimento_calca", None),
        medida_comprimento_blusa=getattr(pedido, "medida_comprimento_blusa", None),
        medida_largura_manga=getattr(pedido, "medida_largura_manga", None),
        medida_comprimento_manga=getattr(pedido, "medida_comprimento_manga", None),
        medida_punho=getattr(pedido, "medida_punho", None),
        medida_comprimento_saia=getattr(pedido, "medida_comprimento_saia", None),
        medida_comprimento_bermuda=getattr(pedido, "medida_comprimento_bermuda", None),
        comentario_medidas=getattr(pedido, "comentario_medidas", None),
        observacao_pedido=pedido.observacao_pedido,
        param_preco_hora=getattr(pedido, "param_preco_hora", None),
        param_impostos=getattr(pedido, "param_impostos", None),
        param_cartao_credito=getattr(pedido, "param_cartao_credito", None),
        param_total_horas_mes=getattr(pedido, "param_total_horas_mes", None),
        param_margem_target=getattr(pedido, "param_margem_target", None),
        foto_url_2=_norm_foto_url(getattr(pedido, "foto_url_2", None)),
        foto_url_3=_norm_foto_url(getattr(pedido, "foto_url_3", None)),
        comentario_foto_1=getattr(pedido, "comentario_foto_1", None),
        comentario_foto_2=getattr(pedido, "comentario_foto_2", None),
        comentario_foto_3=getattr(pedido, "comentario_foto_3", None),
        created_at=pedido.created_at,
        updated_at=pedido.updated_at,
    )


@router.patch("/{pedido_id}/status", response_model=PedidoListItem)
def update_pedido_status(
    pedido_id: int,
    data: PedidoStatusUpdate,
    db: Session = Depends(get_db),
):
    """Atualiza apenas o status do pedido (usado pelos ícones)."""
    service = PedidoService(db)
    pedido = service.update_status(pedido_id, data.status)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return service.to_list_item(pedido)


@router.patch("/{pedido_id}", response_model=PedidoListItem)
def update_pedido(pedido_id: int, data: PedidoUpdate, db: Session = Depends(get_db)):
    """Atualiza pedido."""
    service = PedidoService(db)
    pedido = service.update(pedido_id, data)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return service.to_list_item(pedido)
