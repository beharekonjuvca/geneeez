from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from app.db import get_db
from app.utils.deps import current_user
from app.models import User, Dataset, AnalysisRun, Project 

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/summary", response_model=dict)
def stats_summary(db: Session = Depends(get_db), user: User = Depends(current_user)):
    ds_count = db.query(func.count()).select_from(Dataset).filter(Dataset.owner_id == user.id).scalar()
    ar_count = db.query(func.count()).select_from(AnalysisRun).filter(AnalysisRun.user_id == user.id).scalar()

    try:
        pr_count = db.query(func.count()).select_from(Project).filter(Project.owner_id == user.id).scalar()
    except Exception:
        pr_count = 0

    latest_ds = (
        db.query(Dataset)
        .filter(Dataset.owner_id == user.id)
        .order_by(Dataset.created_at.desc())
        .limit(5)
        .all()
    )
    latest_ar = (
        db.query(AnalysisRun)
        .filter(AnalysisRun.user_id == user.id)
        .order_by(AnalysisRun.created_at.desc())
        .limit(5)
        .all()
    )
    latest_pr = []
    try:
        latest_pr = (
            db.query(Project)
            .filter(Project.owner_id == user.id)
            .order_by(Project.created_at.desc())
            .limit(5)
            .all()
        )
    except Exception:
        pass

    return {
        "counts": {
            "projects": pr_count,
            "datasets": ds_count,
            "analyses": ar_count,
        },
        "latest_datasets": [
            {
                "id": d.id,
                "title": d.title,
                "n_rows": d.n_rows,
                "n_cols": d.n_cols,
                "created_at": d.created_at,
            }
            for d in latest_ds
        ],
        "latest_analyses": [
            {
                "id": r.id,
                "dataset_id": r.dataset_id,
                "recipe_key": r.recipe_key,
                "status": str(r.status),
                "created_at": r.created_at,
            }
            for r in latest_ar
        ],
        "latest_projects": [
            {"id": p.id, "name": p.name, "created_at": p.created_at}
            for p in latest_pr
        ],
    }
