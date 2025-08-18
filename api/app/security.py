import os, hashlib
import jwt
from datetime import datetime, timedelta, timezone
from passlib.hash import bcrypt
from sqlalchemy.orm import Session

from app.config import settings
from app.models import RefreshToken, User

def hash_pw(pw: str) -> str:
    return bcrypt.hash(pw)

def check_pw(pw: str, hashed: str) -> bool:
    return bcrypt.verify(pw, hashed)

def sign_access(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TTL_MIN),
    }
    return jwt.encode(payload, settings.JWT_ACCESS_SECRET, algorithm="HS256")

def issue_refresh(db: Session, user: User) -> str:
    raw = os.urandom(32).hex()
    th = hashlib.sha256(raw.encode()).hexdigest()
    exp = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TTL_DAYS)
    db.add(RefreshToken(user_id=user.id, token_hash=th, expires_at=exp))
    db.commit()
    return raw

def revoke_refresh(db: Session, raw: str):
    th = hashlib.sha256(raw.encode()).hexdigest()
    db.query(RefreshToken).filter(RefreshToken.token_hash == th).update({"revoked": True})
    db.commit()

def validate_refresh(db: Session, raw: str) -> User | None:
    th = hashlib.sha256(raw.encode()).hexdigest()
    rt = db.query(RefreshToken).filter(RefreshToken.token_hash == th).first()
    if not rt or rt.revoked or rt.expires_at < datetime.now(timezone.utc):
        return None
    return db.query(User).get(rt.user_id)

def decode_access(token: str) -> dict:
    return jwt.decode(token, settings.JWT_ACCESS_SECRET, algorithms=["HS256"])
