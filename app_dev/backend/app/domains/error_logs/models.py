"""
Modelo ErrorLog - registro permanente de erros não tratados do backend,
para permitir debugar produção sem depender apenas do journalctl da VM.
"""
from sqlalchemy import Column, DateTime, Integer, String, Text, func

from app.core.database import Base


class ErrorLog(Base):
    __tablename__ = "error_logs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)
    method = Column(String(10), nullable=False)
    path = Column(String(255), nullable=False)
    status_code = Column(Integer, nullable=False)
    exception_type = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    traceback = Column(Text, nullable=False)
