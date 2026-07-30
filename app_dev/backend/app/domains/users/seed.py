"""
Seed de usuários - cria admin inicial se não existir.

A senha do admin NUNCA fica no código: vem de ADMIN_PASSWORD no ambiente.
Sem essa variável o seed é pulado — melhor não criar admin nenhum do que
criar um com senha previsível.
"""
import os

from sqlalchemy.orm import Session

from .models import User
from .repository import UserRepository
from ..auth.password_utils import hash_password


ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "ilma@atelieilmaguerra.com")
ADMIN_NOME = os.environ.get("ADMIN_NOME", "Ilma Guerra")


def seed_admin_user(db: Session) -> int:
    """
    Cria usuário admin se não existir.
    Retorna 1 se criou, 0 se já existia ou se ADMIN_PASSWORD não foi definida.
    """
    repo = UserRepository(db)
    if repo.get_by_email(ADMIN_EMAIL):
        return 0

    admin_password = os.environ.get("ADMIN_PASSWORD")
    if not admin_password:
        print(
            "Seed: usuário admin NÃO criado — defina ADMIN_PASSWORD no .env "
            "para criar o admin inicial."
        )
        return 0
    from datetime import datetime
    now = datetime.now()
    admin = User(
        email=ADMIN_EMAIL,
        nome=ADMIN_NOME,
        password_hash=hash_password(admin_password),
        role="admin",
        ativo=1,
        created_at=now,
        updated_at=now,
    )
    repo.create(admin)
    return 1
