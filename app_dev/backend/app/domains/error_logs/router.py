"""
Router do domínio Logs - consulta de erros registrados no backend.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.dependencies import require_admin

from .repository import LogRepository
from .schemas import ErrorLogDetail, ErrorLogItem

# Tracebacks expõem caminhos, SQL e às vezes valores de dados — só admin.
router = APIRouter(prefix="/logs", tags=["Logs"])
_admin = Depends(require_admin)


@router.get("", response_model=List[ErrorLogItem])
def list_logs(limit: int = 100, db: Session = Depends(get_db), _a=_admin):
    """Lista os erros mais recentes registrados no backend (para debug). Apenas admin."""
    repo = LogRepository(db)
    return repo.list_recent(limit)


@router.get("/{log_id}", response_model=ErrorLogDetail)
def get_log(log_id: int, db: Session = Depends(get_db), _a=_admin):
    """Detalhe de um erro, incluindo o traceback completo. Apenas admin."""
    repo = LogRepository(db)
    log = repo.get_by_id(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log não encontrado")
    return log
