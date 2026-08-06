"""
Repository do domínio Auth.

Leitura direta de `users` — este app só precisa autenticar; criar, editar e
desativar usuários é feito no sistema de gestão.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.domains.users.models import User


class AuthRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_user_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()
