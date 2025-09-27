from typing import Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime

class AdminUserOut(BaseModel):
    id: int
    email: EmailStr
    role: str
    created_at: datetime
    class Config:
        from_attributes = True

class AdminUserUpdate(BaseModel):
    role: Optional[str] = None          
    new_password: Optional[str] = None 
    is_active: Optional[bool] = None    

class AdminCreateUser(BaseModel):
    email: EmailStr
    password: str
    role: Optional[str] = "user"
