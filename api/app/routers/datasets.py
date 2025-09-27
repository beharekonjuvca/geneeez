from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, Dataset, Project
from app.schemas import DatasetCreate, DatasetOut
from app.utils.deps import current_user
from app.services.dataset_service import create_dataset, list_datasets, delete_dataset
from sqlalchemy import select


router = APIRouter()

@router.get("", response_model=List[DatasetOut])
def get_my_datasets(
    db: Session = Depends(get_db),
    user: User = Depends(current_user),

    q: Optional[str] = Query(None),
    min_rows: Optional[int] = Query(None),
    max_rows: Optional[int] = Query(None),
    min_cols: Optional[int] = Query(None),
    max_cols: Optional[int] = Query(None),
    created_from: Optional[str] = Query(None),
    created_to: Optional[str] = Query(None),
    order_by: Optional[str] = Query("created_at"),
    direction: Optional[str] = Query("desc"),
    project_id: Optional[int] = Query(None, description="Filter by project id"),
    unassigned: Optional[bool] = Query(None, description="Only datasets with no project"),  # <— NEW
    limit: int = Query(50, ge=1, le=200),
):
    query = select(Dataset).where(Dataset.owner_id == user.id)

    if q:
        like = f"%{q}%"
        query = query.where(
            (Dataset.title.ilike(like)) | (Dataset.description.ilike(like))
        )

    if unassigned:
        query = query.where(Dataset.project_id.is_(None))
    elif project_id is not None:
        query = query.where(Dataset.project_id == project_id)

    if min_rows is not None:
        query = query.where(Dataset.n_rows >= min_rows)
    if max_rows is not None:
        query = query.where(Dataset.n_rows <= max_rows)
    if min_cols is not None:
        query = query.where(Dataset.n_cols >= min_cols)
    if max_cols is not None:
        query = query.where(Dataset.n_cols <= max_cols)
    if created_from:
        query = query.where(Dataset.created_at >= created_from)
    if created_to:
        query = query.where(Dataset.created_at <= created_to)

    fields = {
        "title": Dataset.title,
        "created_at": Dataset.created_at,
        "n_rows": Dataset.n_rows,
        "n_cols": Dataset.n_cols,
    }
    sort_field = fields.get(order_by, Dataset.created_at)
    query = query.order_by(sort_field.asc() if direction == "asc" else sort_field.desc())
    query = query.limit(limit)

    return db.execute(query).scalars().all()

@router.post("/upload", response_model=DatasetOut)
async def upload_dataset(
    title: str = Form(...),
    description: str | None = Form(None),
    file: UploadFile = File(...),
    project_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    allowed = {
        "text/csv", "text/plain",
        "application/gzip", "application/x-gzip",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    if project_id is not None:
        proj = db.query(Project).filter(
            Project.id == project_id,
            Project.owner_id == user.id
        ).first()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

    ds = create_dataset(
        db, user,
        title=title,
        description=description,
        upload=file,
        project_id=project_id,          
    )
    return ds

@router.delete("/{dataset_id}", status_code=204)
def remove_dataset(dataset_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    ok = delete_dataset(db, user, dataset_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Dataset not found")
