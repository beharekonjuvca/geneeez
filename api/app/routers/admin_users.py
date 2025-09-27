from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, func
from app.db import get_db
from app.models import User
from app.security import hash_pw
from app.utils.admin_only import admin_only
from app.schemas_admin import AdminUserOut, AdminUserUpdate, AdminCreateUser

router = APIRouter(prefix="/admin/users", tags=["admin-users"])

@router.get("", response_model=List[AdminUserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),

    q: Optional[str] = Query(None, description="Search by email or id"),
    role: Optional[str] = Query(None, description="Filter by role"),
    created_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    created_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    order_by: str = Query("created_at", regex="^(email|created_at|id)$"),
    direction: str = Query("desc", regex="^(asc|desc)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = select(User)

    if q:
        like = f"%{q}%"
        query = query.where(or_(User.email.ilike(like), func.cast(User.id, func.TEXT).ilike(like)))
    if role:
        query = query.where(User.role == role)
    if created_from:
        query = query.where(User.created_at >= created_from)
    if created_to:
        query = query.where(User.created_at <= created_to)

    sort_map = {"email": User.email, "created_at": User.created_at, "id": User.id}
    sort_col = sort_map.get(order_by, User.created_at)
    query = query.order_by(sort_col.asc() if direction == "asc" else sort_col.desc())
    query = query.offset(offset).limit(limit)

    return db.execute(query).scalars().all()

@router.get("/count", response_model=dict)
def count_users(
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
    role: Optional[str] = Query(None),
):
    q = select(func.count()).select_from(User)
    if role:
        q = q.where(User.role == role)
    return {"count": db.execute(q).scalar_one()}

@router.post("", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: AdminCreateUser,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")
    u = User(email=body.email, password_hash=hash_pw(body.password), role=body.role or "user")
    db.add(u); db.commit(); db.refresh(u)
    return u

@router.patch("/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: int,
    body: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    if u.id == admin.id and body.role and body.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot demote yourself")

    if body.role is not None:
        u.role = body.role
    if body.new_password:
        u.password_hash = hash_pw(body.new_password)
    if hasattr(u, "is_active") and body.is_active is not None:
        if u.id == admin.id and body.is_active is False:
            raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
        u.is_active = body.is_active

    db.commit(); db.refresh(u)
    return u

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if u.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    db.delete(u); db.commit()
    return
