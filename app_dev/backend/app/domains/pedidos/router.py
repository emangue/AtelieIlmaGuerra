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
from app.domains.auth.router import get_user_id_from_token
from app.domains.historico.repository import registrar_alteracao
from sqlalchemy.orm import Session

MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB

from .schemas import PedidoCreate, PedidoUpdate, PedidoStatusUpdate, PedidoListItem, PedidoDetail, PedidoEntregueItem, TipoPedidoItem, FormaPecaItem, ParcelaCreate, ParcelasConfig, ParcelaOut, CustosReceberOut, PedidoHistoricoResponse
from .service import PedidoService, PedidoAtipicoWarning, _norm_foto_url


def _avisos_detail(exc: PedidoAtipicoWarning) -> dict:
    return {
        "code": "pedido_atipico",
        "avisos": [{"codigo": a.codigo, "mensagem": a.mensagem} for a in exc.avisos],
        "margem_real_calculada": exc.margem_real,
    }
from .models import FormaPeca, FormaPecaMedida

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads"
(UPLOADS_DIR / "pedidos").mkdir(parents=True, exist_ok=True)

# Auth no router inteiro, inclusive nos GETs: o detalhe do pedido devolve nome
# da cliente e medidas corporais — dado pessoal que não pode ficar aberto.
router = APIRouter(
    prefix="/pedidos",
    tags=["Pedidos"],
    dependencies=[Depends(get_user_id_from_token)],
)


@router.get("/todos", response_model=List[PedidoListItem])
def list_pedidos_todos(
    mes: Optional[str] = Query(None, description="YYYYMM - filtra por data_entrega no mês"),
    status: Optional[str] = Query(None, description="Filtra por status exato (ex: Orçamento, Entregue)"),
    db: Session = Depends(get_db),
):
    """Lista todos os pedidos. Use mes=YYYYMM para filtrar por mês de entrega, status= para filtrar por status."""
    service = PedidoService(db)
    pedidos = service.list_all(mes=mes, status=status)
    return [service.to_list_item(p) for p in pedidos]


@router.get("/historico", response_model=PedidoHistoricoResponse)
def list_pedidos_historico(
    q: Optional[str] = Query(None, description="Busca por nome do cliente, descrição ou status"),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    mes: Optional[str] = Query(None, description="YYYYMM - filtra por data_entrega no mês"),
    status: Optional[str] = Query(None, description="Filtra por status exato"),
    tipo: Optional[str] = Query(None, description="Filtra por tipo de pedido"),
    repasse_funcionaria: bool = Query(False, description="Filtra pedidos que geraram repasse para funcionária"),
    percentual_lucro_dono: Optional[float] = Query(None, ge=0, le=100, description="Filtra pelo percentual que fica com Ilma"),
    db: Session = Depends(get_db),
):
    """Busca paginada de pedidos com eager loading. Ideal para histórico."""
    service = PedidoService(db)
    items, total, total_valor_pecas, percentuais_lucro_dono = service.search_historico(
        q=q,
        offset=offset,
        limit=limit,
        mes=mes,
        status=status,
        tipo=tipo,
        repasse_funcionaria=repasse_funcionaria,
        percentual_lucro_dono=percentual_lucro_dono,
    )
    return PedidoHistoricoResponse(
        items=[service.to_list_item(p) for p in items],
        total=total,
        has_more=(offset + limit) < total,
        total_valor_pecas=total_valor_pecas,
        percentuais_lucro_dono=percentuais_lucro_dono,
    )


@router.get("/entregues", response_model=List[PedidoEntregueItem])
def list_pedidos_entregues(
    mes: str = Query(..., description="YYYYMM - mês de referência"),
    db: Session = Depends(get_db),
):
    """Lista pedidos entregues no mês (para transações do financeiro)."""
    service = PedidoService(db)
    pedidos = service.list_entregues(mes)
    return [
        PedidoEntregueItem(
            id=p.id,
            tipo_pedido_nome=p.tipo_pedido.nome if p.tipo_pedido else "Outros",
            valor_pecas=float(p.valor_pecas or 0),
            data_entrega=p.data_entrega,
            cliente_nome=p.cliente.nome if p.cliente else "",
        )
        for p in pedidos
    ]


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
async def upload_foto_pedido(
    file: UploadFile,
    _user_id: int = Depends(get_user_id_from_token),
):
    """Recebe foto, salva em uploads/pedidos e retorna a URL."""
    ext = Path(file.filename or "img").suffix or ".jpg"
    if ext.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    path = UPLOADS_DIR / "pedidos" / name
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Arquivo muito grande. Máximo: 8 MB.")
    path.write_bytes(content)
    # URL relativa: funciona em prod (mesmo domínio) e dev (rewrite)
    base = os.environ.get("BACKEND_URL", "").rstrip("/")
    url = f"{base}/uploads/pedidos/{name}" if base else f"/uploads/pedidos/{name}"
    return {"url": url}


@router.post("", response_model=PedidoListItem, status_code=201)
def create_pedido(
    data: PedidoCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id_from_token),
):
    """Cria novo pedido."""
    service = PedidoService(db)
    try:
        pedido = service.create(data)
    except PedidoAtipicoWarning as exc:
        raise HTTPException(status_code=422, detail=_avisos_detail(exc))
    registrar_alteracao(
        db, user_id=user_id, entidade="pedido", entidade_id=pedido.id, acao="criou",
        resumo=f"Pedido #{pedido.id} criado",
    )
    db.commit()
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
        horas_trabalho=pedido.horas_trabalho,
        custo_materiais=pedido.custo_materiais,
        custos_variaveis=pedido.custos_variaveis,
        margem_real=pedido.margem_real,
        valor_entrada=pedido.valor_entrada,
        valor_restante=pedido.valor_restante,
        detalhes_pagamento=pedido.detalhes_pagamento,
        canal_cartao=getattr(pedido, "canal_cartao", None),
        data_compra_cartao=getattr(pedido, "data_compra_cartao", None),
        taxa_cartao_valor=getattr(pedido, "taxa_cartao_valor", None),
        taxa_cartao_percentual=getattr(pedido, "taxa_cartao_percentual", None),
        taxa_cartao_manual=getattr(pedido, "taxa_cartao_manual", None),
        desconto_pix_valor=getattr(pedido, "desconto_pix_valor", None),
        desconto_pix_percentual=getattr(pedido, "desconto_pix_percentual", None),
        desconto_pix_manual=getattr(pedido, "desconto_pix_manual", None),
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
    user_id: int = Depends(get_user_id_from_token),
):
    """Atualiza apenas o status do pedido (usado pelos ícones)."""
    service = PedidoService(db)
    pedido_antes = service.get_by_id(pedido_id)
    if not pedido_antes:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    status_antes = pedido_antes.status
    pedido = service.update_status(pedido_id, data.status)
    registrar_alteracao(
        db, user_id=user_id, entidade="pedido", entidade_id=pedido_id, acao="mudou_status",
        resumo=f"status: {status_antes} → {data.status}",
        antes={"status": status_antes}, depois={"status": data.status},
    )
    db.commit()
    return service.to_list_item(pedido)


@router.patch("/{pedido_id}", response_model=PedidoListItem)
def update_pedido(
    pedido_id: int,
    data: PedidoUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id_from_token),
):
    """Atualiza pedido."""
    service = PedidoService(db)
    pedido_antes = service.get_by_id(pedido_id)
    if not pedido_antes:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    campos_alterados = data.model_dump(exclude_unset=True)
    antes = {k: getattr(pedido_antes, k, None) for k in campos_alterados}
    try:
        pedido = service.update(pedido_id, data)
    except PedidoAtipicoWarning as exc:
        raise HTTPException(status_code=422, detail=_avisos_detail(exc))
    depois = {k: getattr(pedido, k, None) for k in campos_alterados}
    registrar_alteracao(
        db, user_id=user_id, entidade="pedido", entidade_id=pedido_id, acao="editou",
        antes=antes, depois=depois,
    )
    db.commit()
    return service.to_list_item(pedido)


@router.get("/{pedido_id}/parcelas", response_model=list[ParcelaOut])
def get_parcelas(pedido_id: int, db: Session = Depends(get_db)):
    """Retorna as parcelas do pedido."""
    from app.domains.plano.pagamentos_model import Pagamento
    from datetime import date as date_type
    parcelas = (
        db.query(Pagamento)
        .filter(Pagamento.pedido_id == pedido_id, Pagamento.tipo == "receita")
        .order_by(Pagamento.parcela_numero.asc().nullslast(), Pagamento.data_vencimento.asc())
        .all()
    )
    return [
        ParcelaOut(
            id=p.id,
            parcela_numero=p.parcela_numero,
            parcela_total=p.parcela_total,
            valor=p.valor,
            data_vencimento=p.data_vencimento.isoformat() if p.data_vencimento else None,
            data_pagamento=p.data_pagamento.isoformat() if p.data_pagamento else None,
            descricao=p.descricao,
            status=p.status,
            forma_pagamento=p.forma_pagamento,
            liquidacao_automatica=bool(p.liquidacao_automatica),
            desconto_adiantamento=p.desconto_adiantamento,
        )
        for p in parcelas
    ]


@router.get("/{pedido_id}/custos-receber", response_model=CustosReceberOut)
def get_custos_receber(pedido_id: int, db: Session = Depends(get_db)):
    """Quanto do pedido não chega na mão da Ilma (taxa de cartão + desconto Pix)."""
    from app.domains.plano.pagamentos_model import Pagamento
    from app.domains.plano.custos_financeiros import calcular_custos

    service = PedidoService(db)
    pedido = service.get_by_id(pedido_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    parcelas = (
        db.query(Pagamento)
        .filter(Pagamento.pedido_id == pedido_id, Pagamento.tipo == "receita", Pagamento.origem == "pedido")
        .all()
    )
    custos = calcular_custos(db, pedido, parcelas)
    total = (custos["taxa_cartao_valor"] or 0) + (custos["desconto_pix_valor"] or 0)
    return CustosReceberOut(
        taxa_cartao_valor=custos["taxa_cartao_valor"] or 0,
        taxa_cartao_percentual=custos["taxa_cartao_percentual"],
        taxa_cartao_manual=bool(pedido.taxa_cartao_manual),
        desconto_pix_valor=custos["desconto_pix_valor"] or 0,
        desconto_pix_percentual=custos["desconto_pix_percentual"],
        desconto_pix_manual=bool(pedido.desconto_pix_manual),
        base_cartao=custos["base_cartao"],
        base_pix=custos["base_pix"],
        pago_100_pct_pix=custos["pago_100_pct_pix"],
        canal_cartao=pedido.canal_cartao,
        data_compra_cartao=pedido.data_compra_cartao.isoformat() if pedido.data_compra_cartao else None,
        valor_liquido=round((pedido.valor_pecas or 0) - total, 2),
    )


@router.post("/{pedido_id}/pagamento", response_model=list[ParcelaOut], status_code=201)
def configurar_pagamento(
    pedido_id: int,
    data: ParcelasConfig,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id_from_token),
):
    """Cria ou recria as parcelas de um pedido. Apaga as anteriores e insere as novas."""
    from app.domains.plano.pagamentos_model import Pagamento
    from app.domains.plano.custos_financeiros import (
        ORIGENS_CUSTO, aplicar_custos, is_cartao, sync_custos_financeiros,
    )
    from datetime import datetime as dt, date as date_type

    service = PedidoService(db)
    pedido = service.get_by_id(pedido_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    # Apagar parcelas existentes e as despesas de custo que elas geraram — senão
    # sobram lançamentos órfãos de uma configuração que não existe mais.
    db.query(Pagamento).filter(
        Pagamento.pedido_id == pedido_id,
        Pagamento.tipo == "receita",
    ).delete()
    db.query(Pagamento).filter(
        Pagamento.pedido_id == pedido_id,
        Pagamento.origem.in_(ORIGENS_CUSTO),
    ).delete(synchronize_session=False)

    tipo_nome = pedido.tipo_pedido.nome if pedido.tipo_pedido else "Pedido"
    cliente_nome = pedido.cliente.nome if pedido.cliente else ""
    descricao_base = f"{tipo_nome} · {cliente_nome}" if cliente_nome else tipo_nome
    entrada_valida = data.entrada if data.entrada and data.entrada.valor > 0 else None
    parcelas_validas = [parc for parc in data.parcelas if parc.valor > 0]

    novas: list[Pagamento] = []
    total_parcelas = len(parcelas_validas) + (1 if entrada_valida else 0)

    def _parse(d: str) -> date_type:
        return dt.strptime(d, "%Y-%m-%d").date()

    def _montar(parc, numero: int, descricao: str, forma_padrao: Optional[str]) -> Pagamento:
        """Parcela de cartão não se confirma: nasce com a data prevista de crédito
        já preenchida, para cair sozinha no financeiro do mês certo."""
        forma = parc.forma_pagamento or forma_padrao
        automatica = is_cartao(forma)
        data_venc = _parse(parc.data_vencimento)
        if automatica:
            data_pag = data_venc
        else:
            data_pag = _parse(parc.data_pagamento) if parc.data_pagamento else None
        return Pagamento(
            anomes=f"{data_pag.year}{data_pag.month:02d}" if data_pag else None,
            tipo="receita",
            origem="pedido",
            pedido_id=pedido_id,
            parcela_numero=numero,
            parcela_total=total_parcelas,
            data_vencimento=data_venc,
            data_pagamento=data_pag,
            valor=parc.valor,
            descricao=descricao,
            forma_pagamento=forma,
            liquidacao_automatica=automatica,
        )

    num = 1
    if entrada_valida:
        novas.append(_montar(entrada_valida, num, f"Entrada · {descricao_base}", data.forma_pagamento))
        num += 1

    for parc in parcelas_validas:
        numero_exibido = num - (1 if entrada_valida else 0)
        novas.append(_montar(parc, num, f"Parcela {numero_exibido} · {descricao_base}", data.forma_pagamento))
        num += 1

    for p in novas:
        db.add(p)

    formas_usadas = {p.forma_pagamento for p in novas if p.forma_pagamento}
    if len(formas_usadas) > 1:
        pedido.forma_pagamento = "Misto"
    elif formas_usadas:
        pedido.forma_pagamento = next(iter(formas_usadas))
    elif data.forma_pagamento:
        pedido.forma_pagamento = data.forma_pagamento

    pedido.valor_entrada = entrada_valida.valor if entrada_valida else None
    pedido.valor_restante = round(sum(parc.valor for parc in parcelas_validas), 2) if parcelas_validas else None
    pedido.pagamento_na_entrega = False

    if data.canal_cartao is not None:
        pedido.canal_cartao = data.canal_cartao
    if data.data_compra_cartao:
        pedido.data_compra_cartao = _parse(data.data_compra_cartao)

    # Valor informado à mão vence o cálculo automático e fica marcado como manual,
    # para que uma edição de preço depois não apague o número dela.
    if data.taxa_cartao_valor is not None:
        pedido.taxa_cartao_valor = data.taxa_cartao_valor
        pedido.taxa_cartao_manual = True
    if data.desconto_pix_valor is not None:
        pedido.desconto_pix_valor = data.desconto_pix_valor
        pedido.desconto_pix_manual = True

    db.flush()
    aplicar_custos(db, pedido, novas)
    sync_custos_financeiros(db, pedido)
    # A margem depende do custo de receber, que só é conhecido agora que as formas
    # de pagamento estão definidas.
    service.recalcular_margem(pedido)

    registrar_alteracao(
        db, user_id=user_id, entidade="pedido", entidade_id=pedido_id, acao="editou",
        resumo="Parcelas de pagamento reconfiguradas",
    )
    db.commit()
    return get_parcelas(pedido_id, db)


@router.delete("/{pedido_id}", status_code=204)
def delete_pedido(
    pedido_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id_from_token),
):
    """Exclui um pedido e seus pagamentos associados."""
    from app.domains.plano.pagamentos_model import Pagamento

    service = PedidoService(db)
    pedido = service.get_by_id(pedido_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    resumo = f"Pedido #{pedido_id} apagado ({pedido.descricao_produto or ''})".strip()
    db.query(Pagamento).filter(Pagamento.pedido_id == pedido_id).delete()
    db.delete(pedido)
    registrar_alteracao(
        db, user_id=user_id, entidade="pedido", entidade_id=pedido_id, acao="apagou", resumo=resumo,
    )
    db.commit()
