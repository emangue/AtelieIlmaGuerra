"""
Mapeamento PedidoAtendimento -> schemas de resposta.

Espelhado em app_atendimento/backend/app/domains/atendimentos/service.py — a
diferença é que lá o registro só é visível para quem o criou não importa; aqui
a Ilma vê todos.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.domains.pedidos.service import _norm_foto_url
from app.domains.users.models import User

from .models import MEDIDAS_CAMPOS, PedidoAtendimento
from .schemas import AtendimentoDetail, AtendimentoListItem


def _nome_usuario(db: Session, user_id: Optional[int]) -> Optional[str]:
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    return user.nome if user else f"Usuário #{user_id}"


def to_list_item(db: Session, a: PedidoAtendimento) -> AtendimentoListItem:
    return AtendimentoListItem(
        id=a.id,
        tipo=a.tipo,
        cliente_id=a.cliente_id,
        cliente_nome=a.cliente.nome if a.cliente else "",
        tipo_pedido_nome=a.tipo_pedido.nome if a.tipo_pedido else None,
        forma_peca_nome=a.forma_peca.nome if a.forma_peca else None,
        descricao_produto=a.descricao_produto or "",
        data_pedido=a.data_pedido,
        data_entrega=a.data_entrega,
        quantidade_pecas=a.quantidade_pecas,
        valor_combinado=a.valor_combinado,
        status_aprovacao=a.status_aprovacao,
        motivo_recusa=a.motivo_recusa,
        pedido_id=a.pedido_id,
        criado_por_nome=_nome_usuario(db, a.criado_por_user_id) or "",
        criado_em=a.criado_em,
        revisado_em=a.revisado_em,
        foto_url=_norm_foto_url(a.foto_url),
    )


def to_detail(db: Session, a: PedidoAtendimento) -> AtendimentoDetail:
    medidas = {campo: getattr(a, campo, None) for campo in MEDIDAS_CAMPOS}
    return AtendimentoDetail(
        **to_list_item(db, a).model_dump(),
        tipo_pedido_id=a.tipo_pedido_id,
        forma_peca_id=a.forma_peca_id,
        observacao_atendimento=a.observacao_atendimento,
        medidas_disponiveis=a.medidas_disponiveis,
        comentario_medidas=a.comentario_medidas,
        fotos_disponiveis=a.fotos_disponiveis,
        foto_url_2=_norm_foto_url(a.foto_url_2),
        foto_url_3=_norm_foto_url(a.foto_url_3),
        comentario_foto_1=a.comentario_foto_1,
        comentario_foto_2=a.comentario_foto_2,
        comentario_foto_3=a.comentario_foto_3,
        revisado_por_nome=_nome_usuario(db, a.revisado_por_user_id),
        **medidas,
    )
