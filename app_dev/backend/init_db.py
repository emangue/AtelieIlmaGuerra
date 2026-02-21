"""
Inicializa o banco de dados e cria usuário admin.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import engine, Base
from app.domains.users.models import User
from app.domains.contracts.models import Contract  # para criar tabela
from app.domains.auth.password_utils import hash_password
from datetime import datetime

def init_db():
    Base.metadata.create_all(bind=engine)

    from sqlalchemy.orm import sessionmaker
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == "admin@atelie.com").first()
        if not existing:
            admin = User(
                email="admin@atelie.com",
                password_hash=hash_password("admin123"),
                nome="Administrador",
                ativo=1,
                role="admin",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(admin)
            db.commit()
            print("✅ Usuário admin criado: admin@atelie.com / admin123")
        else:
            print("ℹ️ Usuário admin já existe")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
