"""
Utilitários para hash de senhas com bcrypt.

ESPELHO de app_dev/backend/app/domains/auth/password_utils.py.
Cópia literal — se mexer lá, mexa aqui. O site de atendimento é um app separado
de propósito (isolamento de dados), e o preço disso é manter estes poucos
arquivos em sincronia.
"""
import bcrypt


def hash_password(password: str) -> str:
    pwd = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd = plain_password.encode("utf-8")[:72]
    hashed = hashed_password.encode("utf-8")
    return bcrypt.checkpw(pwd, hashed)
