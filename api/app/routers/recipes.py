from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import AnalysisRecipeTemplate, AnalysisRun, RunStatus
from app.schemas import RecipeTemplateOut, RunParams, RunOut
from app.utils.deps import current_user
from app.services.analysis_service import (
    ensure_dataset_access, dataset_fingerprint, make_cache_key, create_run, mark_run_cached
)
from app.services.analytics_exec import execute_inline
from datetime import datetime
router = APIRouter()

@router.get("/recipes", response_model=list[RecipeTemplateOut])
def list_recipes(
    db: Session = Depends(get_db),
    user=Depends(current_user),
    dataset_id: int = Query(..., description="Limit to a dataset the user owns (for UI)")
):
    ensure_dataset_access(db, dataset_id, user.id)
    rows = db.query(AnalysisRecipeTemplate).filter(AnalysisRecipeTemplate.is_user_visible == True).all()
    return rows

@router.post("/datasets/{dataset_id}/analytics/run", response_model=RunOut)
def run_recipe(
    dataset_id: int,
    payload: RunParams = Body(...),
    db: Session = Depends(get_db),
    user=Depends(current_user)
):
    ds = ensure_dataset_access(db, dataset_id, user.id)

    tpl = db.query(AnalysisRecipeTemplate).filter(AnalysisRecipeTemplate.key == payload.recipe_key).first()
    if not tpl:
        raise HTTPException(400, "Unknown recipe_key")

    fp = dataset_fingerprint(ds)
    ck = make_cache_key(payload.recipe_key, payload.params, fp)
    cached = None
    run = create_run(db, dataset=ds, user_id=user.id, recipe_key=payload.recipe_key, params=payload.params, cache_key=ck)
    try:
        execute_inline(db, run, ds) 
    except Exception as e:
        run.status = RunStatus.failed
        run.error_message = str(e)
        run.finished_at = datetime.utcnow()
        db.commit()
    return run

@router.get("/analytics/runs/{run_id}", response_model=RunOut)
def get_run(run_id: int, db: Session = Depends(get_db), user=Depends(current_user)):
    run = db.query(AnalysisRun).filter(AnalysisRun.id == run_id, AnalysisRun.user_id == user.id).first()
    if not run:
        raise HTTPException(404, "Run not found")
    return run
