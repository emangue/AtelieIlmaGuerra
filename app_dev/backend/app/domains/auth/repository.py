"""
Repository do domínio Auth.
"""
from sqlalchemy.orm import Session

from app.domains.users.repository import UserRepository


class AuthRepository:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)

    def get_user_by_email(self, email: str):
        return self.user_repo.get_by_email(email)

    def get_user_by_id(self, user_id: int):
        return self.user_repo.get_by_id(user_id)
