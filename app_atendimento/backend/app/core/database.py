"""
Sessão SQLAlchemy do site de atendimento.

Diferença importante em relação ao gestão: aqui NUNCA se roda
`Base.metadata.create_all` nem migration. O schema é criado e versionado só pelo
backend de gestão (app_dev), que é o dono do banco. Este processo assume o
schema pronto — assim os dois não brigam por DDL no mesmo arquivo SQLite.
"""
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

from .config import settings

connect_args = {} if settings.is_postgres else {"check_same_thread": False}
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG,
)

# WAL + busy_timeout: dois processos (gestão :8001 e este :8002) escrevem no
# mesmo arquivo. Sem isso, escrita simultânea vira "database is locked".
if not settings.is_postgres:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
