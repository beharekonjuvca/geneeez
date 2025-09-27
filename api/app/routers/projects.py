# app/routers/projects.py
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Form
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.db import get_db
from app.utils.deps import current_user
from app.models import User, Project, Dataset, AnalysisRun

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("", response_model=dict)
def create_project(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    p = Project(name=name, description=description, owner_id=user.id)
    db.add(p)
    db.commit()
    db.refresh(p)
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "created_at": p.created_at,
    }

@router.get("", response_model=List[dict])
def list_projects(
    db: Session = Depends(get_db),
    user: User = Depends(current_user),

    q: Optional[str] = Query(None, description="Search name/description"),
    created_from: Optional[str] = Query(None, description="ISO date"),
    created_to: Optional[str] = Query(None, description="ISO date"),
    order_by: str = Query("created_at", description="created_at|name|dataset_count|analysis_count"),
    direction: str = Query("desc", description="asc|desc"),
    include_counts: bool = Query(True, description="Include dataset/analysis counts"),
    limit: int = Query(100, ge=1, le=500),
):
    ds_count_sq = (
        select(func.count())
        .select_from(Dataset)
        .where(Dataset.project_id == Project.id)
        .correlate(Project)
        .scalar_subquery()
    )
    ar_count_sq = (
        select(func.count())
        .select_from(AnalysisRun)
        .join(Dataset, Dataset.id == AnalysisRun.dataset_id)
        .where(Dataset.project_id == Project.id)
        .correlate(Project)
        .scalar_subquery()
    )

    cols = [
        Project.id,
        Project.name,
        Project.description,
        Project.created_at,
    ]
    if include_counts:
        cols += [ds_count_sq.label("dataset_count"), ar_count_sq.label("analysis_count")]

    stmt = select(*cols).where(Project.owner_id == user.id)

    if q:
        like = f"%{q}%"
        stmt = stmt.where((Project.name.ilike(like)) | (Project.description.ilike(like)))

    if created_from:
        stmt = stmt.where(Project.created_at >= datetime.fromisoformat(created_from))
    if created_to:
        stmt = stmt.where(Project.created_at <= datetime.fromisoformat(created_to))

    order_map = {
        "created_at": Project.created_at,
        "name": Project.name,
    }
    if include_counts:
        order_map["dataset_count"] = ds_count_sq
        order_map["analysis_count"] = ar_count_sq

    sort_col = order_map.get(order_by, Project.created_at)
    stmt = stmt.order_by(sort_col.asc() if direction == "asc" else sort_col.desc())
    stmt = stmt.limit(limit)

    rows = db.execute(stmt).mappings().all()
    return [dict(r) for r in rows]

@router.get("/{project_id}", response_model=dict)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
    include_counts: bool = Query(True),
):
    ds_count_sq = (
        select(func.count())
        .select_from(Dataset)
        .where(Dataset.project_id == Project.id)
        .correlate(Project)
        .scalar_subquery()
    )
    ar_count_sq = (
        select(func.count())
        .select_from(AnalysisRun)
        .join(Dataset, Dataset.id == AnalysisRun.dataset_id)
        .where(Dataset.project_id == Project.id)
        .correlate(Project)
        .scalar_subquery()
    )

    cols = [Project.id, Project.name, Project.description, Project.created_at]
    if include_counts:
        cols += [ds_count_sq.label("dataset_count"), ar_count_sq.label("analysis_count")]

    stmt = select(*cols).where(Project.id == project_id, Project.owner_id == user.id)
    row = db.execute(stmt).mappings().first()
    if not row:
        raise HTTPException(404, "Project not found")
    return dict(row)

@router.patch("/{project_id}", response_model=dict)
def update_project(
    project_id: int,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    p = db.query(Project).filter(Project.id == project_id, Project.owner_id == user.id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    if name is not None:
        p.name = name
    if description is not None:
        p.description = description
    db.commit()
    db.refresh(p)
    return {"id": p.id, "name": p.name, "description": p.description, "created_at": p.created_at}

@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    p = db.query(Project).filter(Project.id == project_id, Project.owner_id == user.id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    db.delete(p)
    db.commit()
    return

@router.post("/{project_id}/datasets/{dataset_id}", response_model=dict)
def assign_dataset(
    project_id: int,
    dataset_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    p = db.query(Project).filter(Project.id == project_id, Project.owner_id == user.id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == user.id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found")
    ds.project_id = p.id
    db.commit()
    db.refresh(ds)
    return {"dataset_id": ds.id, "project_id": ds.project_id}

@router.delete("/{project_id}/datasets/{dataset_id}", status_code=204)
def unassign_dataset(
    project_id: int,
    dataset_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == user.id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found")
    ds.project_id = None
    db.commit()
    return
