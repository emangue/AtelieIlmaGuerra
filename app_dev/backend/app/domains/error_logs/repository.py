"""
Repository do domínio Logs.
"""
from typing import List, Optional

from sqlalchemy.orm import Session

from .models import ErrorLog


class LogRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        method: str,
        path: str,
        status_code: int,
        exception_type: str,
        message: str,
        traceback: str,
    ) -> ErrorLog:
        log = ErrorLog(
            method=method,
            path=path,
            status_code=status_code,
            exception_type=exception_type,
            message=message[:2000],
            traceback=traceback[:8000],
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def list_recent(self, limit: int = 100) -> List[ErrorLog]:
        return (
            self.db.query(ErrorLog)
            .order_by(ErrorLog.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_by_id(self, log_id: int) -> Optional[ErrorLog]:
        return self.db.query(ErrorLog).filter(ErrorLog.id == log_id).first()
