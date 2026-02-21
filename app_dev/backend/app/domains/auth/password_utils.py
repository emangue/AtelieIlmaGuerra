"""
Utilitários para hash de senhas com bcrypt.
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
