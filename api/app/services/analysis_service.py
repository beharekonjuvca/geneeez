from datetime import datetime
from hashlib import sha256
from sqlalchemy.orm import Session
from app.models import AnalysisRun, AnalysisRecipeTemplate, RunStatus, Dataset

def ensure_dataset_access(db: Session, dataset_id: int, user_id: int) -> Dataset:
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == user_id).first()
    if not ds: raise ValueError("Dataset not found")
    return ds

def dataset_fingerprint(ds: Dataset) -> str:
    raw = f"{ds.id}:{ds.updated_at}:{ds.n_rows}"
    return sha256(raw.encode()).hexdigest()

def make_cache_key(recipe_key: str, params: dict, fp: str) -> str:
    raw = f"{recipe_key}:{fp}:{repr(sorted(params.items()))}"
    return sha256(raw.encode()).hexdigest()

def create_run(db: Session, *, dataset: Dataset, user_id: int, recipe_key: str, params: dict, cache_key: str) -> AnalysisRun:
    run = AnalysisRun(
        dataset_id=dataset.id, user_id=user_id,
        recipe_key=recipe_key, params_json=params,
        status=RunStatus.queued, cache_key=cache_key
    )
    db.add(run); db.commit(); db.refresh(run)
    return run

def mark_run_cached(db: Session, run: AnalysisRun, artifacts: dict) -> AnalysisRun:
    run.status = RunStatus.succeeded
    run.cache_hit = True
    run.started_at = datetime.utcnow()
    run.finished_at = datetime.utcnow()
    run.artifacts_json = artifacts
    db.commit(); db.refresh(run)
    return run
