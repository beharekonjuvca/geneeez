from pydantic import BaseModel, EmailStr, field_validator, Field
from datetime import datetime
from typing import Optional
import re

class AuthIn(BaseModel):
    email: EmailStr
    password: str

class SignupIn(AuthIn):
    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if not 8 <= len(v) <= 64:
            raise ValueError("Password must be 8–64 characters.")
        if " " in v:
            raise ValueError("Password cannot contain spaces.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Add at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Add at least one lowercase letter.")
        if not re.search(r"[0-9]", v):
            raise ValueError("Add at least one digit.")
        if not re.search(r"[^\w\s]", v):
            raise ValueError("Add at least one special character.")
        return v
class DatasetCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None

class DatasetOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    original_filename: str
    file_size_bytes: Optional[int]
    n_rows: Optional[int]
    n_cols: Optional[int]
    is_public: bool
    created_at: datetime
    class Config:
        from_attributes = True