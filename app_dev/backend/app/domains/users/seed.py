"""
Seed de usuários - cria admin inicial se não existir.
"""
from sqlalchemy.orm import Session

from .models import User
from .repository import UserRepository
from ..auth.password_utils import hash_password


ADMIN_EMAIL = "ilma@atelieilmaguerra.com"
ADMIN_PASSWORD = "cahriZqonby8"
ADMIN_NOME = "Ilma Guerra"


def seed_admin_user(db: Session) -> int:
    """
    Cria usuário admin se não existir.
    Retorna 1 se criou, 0 se já existia.
    """
    repo = UserRepository(db)
    if repo.get_by_email(ADMIN_EMAIL):
        return 0
    from datetime import datetime
    now = datetime.now()
    admin = User(
        email=ADMIN_EMAIL,
        nome=ADMIN_NOME,
        password_hash=hash_password(ADMIN_PASSWORD),
        role="admin",
        ativo=1,
        created_at=now,
        updated_at=now,
    )
    repo.create(admin)
    return 1
