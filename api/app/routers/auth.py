from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import AuthIn
from app.schemas import SignupIn
from app.security import hash_pw, check_pw, sign_access, issue_refresh, validate_refresh, revoke_refresh

router = APIRouter()

@router.post("/signup")
def signup(body: SignupIn, response: Response, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    u = User(email=body.email, password_hash=hash_pw(body.password))
    db.add(u); db.commit(); db.refresh(u)

    access = sign_access(u)
    refresh = issue_refresh(db, u)
    response.set_cookie("refresh", refresh, httponly=True, samesite="lax", max_age=60*60*24*7)
    return {"access": access, "user": {"id": u.id, "email": u.email, "role": u.role}}

@router.post("/login")
def login(body: AuthIn, response: Response, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == body.email).first()
    if not u or not check_pw(body.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Bad credentials")
    access = sign_access(u)
    refresh = issue_refresh(db, u)
    response.set_cookie("refresh", refresh, httponly=True, samesite="lax", max_age=60*60*24*7)
    return {"access": access, "user": {"id": u.id, "email": u.email, "role": u.role}}

@router.post("/refresh")
def refresh_token(request: Request, db: Session = Depends(get_db)):
    raw = request.cookies.get("refresh")
    if not raw:
        raise HTTPException(status_code=401, detail="No refresh cookie")
    u = validate_refresh(db, raw)
    if not u:
        raise HTTPException(status_code=401, detail="Invalid/expired refresh")
    return {"access": sign_access(u)}

@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    raw = request.cookies.get("refresh")
    if raw:
        revoke_refresh(db, raw)
    response.delete_cookie("refresh")
    return {"ok": True}

@router.get("/me")
def me(user: User = Depends(lambda: None), db: Session = Depends(get_db), request: Request = None):

    from app.utils.deps import current_user  
    user = current_user(request, db) 
    return {"id": user.id, "email": user.email, "role": user.role}
