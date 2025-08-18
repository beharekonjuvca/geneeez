from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import User
from app.security import decode_access

def current_user(req: Request, db: Session = Depends(get_db)) -> User:
    auth = req.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = auth[7:]
    try:
        data = decode_access(token)
        uid = int(data.get("sub"))
        u = db.query(User).get(uid)
        if not u:
            raise HTTPException(status_code=401, detail="User not found")
        return u
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid/expired access token")
