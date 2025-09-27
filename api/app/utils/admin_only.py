from fastapi import Depends, HTTPException, status
from app.utils.deps import current_user
from app.models import User

def admin_only(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins only")
    return user
