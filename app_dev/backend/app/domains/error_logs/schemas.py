"""
Schemas do domínio Logs.
"""
from datetime import datetime

from pydantic import BaseModel


class ErrorLogItem(BaseModel):
    id: int
    created_at: datetime
    method: str
    path: str
    status_code: int
    exception_type: str
    message: str

    class Config:
        from_attributes = True


class ErrorLogDetail(ErrorLogItem):
    traceback: str
