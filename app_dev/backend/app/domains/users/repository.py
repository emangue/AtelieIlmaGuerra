"""
Repository do domínio Users.
"""
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from .models import User


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()

    def get_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def list_all(self, apenas_ativos: bool = True) -> List[User]:
        query = self.db.query(User)
        if apenas_ativos:
            query = query.filter(User.ativo == 1)
        return query.order_by(User.nome).all()

    def count_all(self, apenas_ativos: bool = True) -> int:
        query = self.db.query(func.count(User.id))
        if apenas_ativos:
            query = query.filter(User.ativo == 1)
        return query.scalar() or 0

    def create(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: User) -> User:
        self.db.commit()
        self.db.refresh(user)
        return user

    def soft_delete(self, user: User) -> User:
        user.ativo = 0
        return self.update(user)

    def email_exists(self, email: str, exclude_id: Optional[int] = None) -> bool:
        query = self.db.query(User).filter(User.email == email)
        if exclude_id:
            query = query.filter(User.id != exclude_id)
        return query.first() is not None
