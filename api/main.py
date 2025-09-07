from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db import init_db
from app.routers import auth, datasets, analysis, recipes, stats
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="geneeez-api")

app.mount("/files", StaticFiles(directory="storage", html=False), name="files")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router, prefix="/auth", tags=["auth"])

app.include_router(datasets.router, prefix="/datasets", tags=["datasets"])

app.include_router(analysis.router, tags=["analysis"]) 

app.include_router(recipes.router, tags=["recipes"])

app.include_router(stats.router, tags=["stats"])


@app.get("/health")
def health():
    return {"ok": True, "service": "geneeez-api"}


@app.on_event("startup")
def _startup():
    init_db()


