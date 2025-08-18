from pydantic import BaseModel, EmailStr, field_validator
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
