"""
Modelo HistoricoAlteracao — espelho de
app_dev/backend/app/domains/historico/models.py.

A tabela é compartilhada com o app de gestão; a coluna `app` separa as duas
origens. Este backend só grava e só lê linhas com app='atendimento'.
"""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func

from app.core.database import Base

APP_ATENDIMENTO = "atendimento"


class HistoricoAlteracao(Base):
    __tablename__ = "historico_alteracoes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_nome = Column(String(200), nullable=False)
    entidade = Column(String(50), nullable=False, index=True)
    entidade_id = Column(Integer, nullable=True, index=True)
    acao = Column(String(30), nullable=False)  # criou | editou | apagou
    resumo = Column(Text, nullable=True)
    diff_json = Column(Text, nullable=True)
    app = Column(String(20), nullable=False, server_default="gestao", default="gestao", index=True)
    criado_em = Column(DateTime, server_default=func.now(), index=True)
