"""
Modelo HistoricoAlteracao - registro genérico de quem criou/editou/apagou o quê,
usado por qualquer domínio de escrita do app (pedidos, clientes, despesas, etc).
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func

from app.core.database import Base


class HistoricoAlteracao(Base):
    __tablename__ = "historico_alteracoes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_nome = Column(String(200), nullable=False)  # desnormalizado — nome não muda se o usuário for desativado depois
    entidade = Column(String(50), nullable=False, index=True)
    entidade_id = Column(Integer, nullable=True, index=True)
    acao = Column(String(30), nullable=False)  # criou | editou | mudou_status | apagou
    resumo = Column(Text, nullable=True)
    diff_json = Column(Text, nullable=True)
    # Qual site originou a alteração: "gestao" ou "atendimento". O site de
    # atendimento só enxerga as próprias linhas.
    app = Column(String(20), nullable=False, server_default="gestao", default="gestao", index=True)
    criado_em = Column(DateTime, server_default=func.now(), index=True)
