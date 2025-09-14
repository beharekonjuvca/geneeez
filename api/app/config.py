import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

    JWT_ACCESS_SECRET: str = os.getenv("JWT_ACCESS_SECRET", "dev-access")
    JWT_REFRESH_SECRET: str = os.getenv("JWT_REFRESH_SECRET", "dev-refresh")
    ACCESS_TTL_MIN: int = int(os.getenv("ACCESS_TTL_MIN", "15"))
    REFRESH_TTL_DAYS: int = int(os.getenv("REFRESH_TTL_DAYS", "7"))

    STORAGE_DIR: str = os.getenv("STORAGE_DIR", "storage")
    UPLOAD_DIR: str  = os.getenv("UPLOAD_DIR",  "uploads") 

    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+psycopg://geneeez:geneeez_pw@localhost:5332/geneeez")
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "geneeez"
    PUBLIC_API_BASE: str = os.getenv("PUBLIC_API_BASE", "http://127.0.0.1:8080")

settings = Settings()
