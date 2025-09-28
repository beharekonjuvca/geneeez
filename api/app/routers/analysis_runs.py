from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db import get_db
from app.utils.deps import current_user
from app.models import AnalysisRun, Dataset, User, RunStatus
from app.services.audit import log_event

router = APIRouter(prefix="/analysis-runs", tags=["analysis-runs"])

@router.get("", response_model=List[dict])
def list_analysis_runs(
    db: Session = Depends(get_db),
    user: User = Depends(current_user),

   
    q: Optional[str] = Query(None, description="Search recipe_key / cache_key / dataset title"),
    dataset_id: Optional[int] = None,
    status: Optional[RunStatus] = None,
    recipe_key: Optional[str] = None,
    created_from: Optional[str] = None,
    created_to: Optional[str] = None,

    order_by: str = Query("created_at", description="created_at|recipe_key|status"),
    direction: str = Query("desc", description="asc|desc"),

    limit: int = Query(50, ge=1, le=200),
):
    stmt = (
        select(
            AnalysisRun.id,
            AnalysisRun.dataset_id,
            AnalysisRun.recipe_key,
            AnalysisRun.status,
            AnalysisRun.cache_hit,
            AnalysisRun.started_at,
            AnalysisRun.finished_at,
            AnalysisRun.created_at,
            Dataset.title.label("dataset_title"),
        )
        .join(Dataset, Dataset.id == AnalysisRun.dataset_id)
        .where(AnalysisRun.user_id == user.id)
    )

    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (AnalysisRun.recipe_key.ilike(like)) |
            (AnalysisRun.cache_key.ilike(like)) |
            (Dataset.title.ilike(like))
        )

    if dataset_id is not None:
        stmt = stmt.where(AnalysisRun.dataset_id == dataset_id)
    if status is not None:
        stmt = stmt.where(AnalysisRun.status == status)
    if recipe_key is not None:
        stmt = stmt.where(AnalysisRun.recipe_key == recipe_key)
    if created_from:
        stmt = stmt.where(AnalysisRun.created_at >= datetime.fromisoformat(created_from))
    if created_to:
        stmt = stmt.where(AnalysisRun.created_at <= datetime.fromisoformat(created_to))

    order_map = {
        "created_at": AnalysisRun.created_at,
        "recipe_key": AnalysisRun.recipe_key,
        "status": AnalysisRun.status,
    }
    col = order_map.get(order_by, AnalysisRun.created_at)
    stmt = stmt.order_by(col.asc() if direction == "asc" else col.desc())

    stmt = stmt.limit(limit)

    rows = db.execute(stmt).mappings().all()
    return [dict(r) for r in rows]


@router.get("/{run_id}", response_model=dict)
def get_run(run_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    stmt = (
        select(AnalysisRun)
        .where(AnalysisRun.id == run_id, AnalysisRun.user_id == user.id)
    )
    run = db.execute(stmt).scalar_one_or_none()
    log_event(db, user_id=user.id, action="analysis_run_finished", entity="analysis_run", entity_id=run.id, metadata={"status": str(run.status)}, request= Request)

    if not run:
        raise HTTPException(404, "Run not found")
    return {
        "id": run.id,
        "dataset_id": run.dataset_id,
        "recipe_key": run.recipe_key,
        "status": run.status,
        "cache_hit": run.cache_hit,
        "started_at": run.started_at,
        "finished_at": run.finished_at,
        "artifacts_json": run.artifacts_json,
        "error_message": run.error_message,
        "created_at": run.created_at,
    }
