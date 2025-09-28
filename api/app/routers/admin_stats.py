from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, select,  or_
from app.db import get_db
from app.models import User, Dataset, AnalysisRun, AdminEvent
from app.utils.admin_only import admin_only
from typing import Optional, List

router = APIRouter(prefix="/admin/stats", tags=["admin-stats"])

def daily_counts(db: Session, model, days: int = 7, tz=timezone.utc, period: str = "day"):
    """
    Returns rows of {"bucket": <datetime>, "count": <int>} for the last N days.
    `period` can be 'day','hour','week' etc. (Postgres date_trunc).
    """
    since = datetime.now(tz) - timedelta(days=days)

    bucket = func.date_trunc(period, model.created_at).label("bucket")

    stmt = (
        select(bucket, func.count().label("count"))
        .where(model.created_at >= since)
        .group_by(bucket)         
        .order_by(bucket)     
    )
    return [
        {"bucket": r.bucket, "count": r.count}
        for r in db.execute(stmt).all()
    ]

@router.get("/overview", response_model=dict)
def admin_overview(
    db: Session = Depends(get_db),
    _admin=Depends(admin_only),
    days: int = Query(7, ge=1, le=60),
):
    total_users = db.scalar(select(func.count()).select_from(User)) or 0
    total_datasets = db.scalar(select(func.count()).select_from(Dataset)) or 0
    total_runs = db.scalar(select(func.count()).select_from(AnalysisRun)) or 0

    trend_users = daily_counts(db, User, days=days)
    trend_datasets = daily_counts(db, Dataset, days=days)
    trend_runs = daily_counts(db, AnalysisRun, days=days)

    recent_events = (
        db.query(AdminEvent)
        .order_by(AdminEvent.created_at.desc())
        .limit(20)
        .all()
    )

    return {
        "totals": {
            "users": total_users,
            "datasets": total_datasets,
            "analysis_runs": total_runs,
        },
        "trends": {
            "users": trend_users,
            "datasets": trend_datasets,
            "analysis_runs": trend_runs,
        },
        "recent_events": [
            {
                "id": e.id,
                "user_id": e.user_id,
                "action": e.action,
                "entity": e.entity,
                "entity_id": e.entity_id,
                "metadata": getattr(e, "meta", None), 
                "ip": e.ip,
                "user_agent": e.user_agent,
                "created_at": e.created_at,
            }
            for e in recent_events
        ],
    }

@router.get("/logs", response_model=List[dict])
def admin_logs(
    db: Session = Depends(get_db),
    _admin=Depends(admin_only),

    q: Optional[str] = Query(None, description="Search across action, entity, user email"),
    action: Optional[str] = Query(None),
    entity: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),

    order_by: str = Query("created_at", regex="^(id|created_at|action|entity)$"),
    direction: str = Query("desc", regex="^(asc|desc)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    stmt = (
        select(
            AdminEvent.id,
            AdminEvent.user_id,
            User.email.label("user_email"),
            AdminEvent.action,
            AdminEvent.entity,
            AdminEvent.entity_id,
            AdminEvent.meta.label("metadata"),
            AdminEvent.ip,
            AdminEvent.user_agent,
            AdminEvent.created_at,
        )
        .join(User, User.id == AdminEvent.user_id, isouter=True)
    )

    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                AdminEvent.action.ilike(like),
                AdminEvent.entity.ilike(like),
                User.email.ilike(like),
            )
        )

    if action:
        stmt = stmt.where(AdminEvent.action == action)
    if entity:
        stmt = stmt.where(AdminEvent.entity == entity)
    if user_id:
        stmt = stmt.where(AdminEvent.user_id == user_id)
    if date_from:
        stmt = stmt.where(AdminEvent.created_at >= date_from)
    if date_to:
        stmt = stmt.where(AdminEvent.created_at <= date_to)

    sort_map = {
        "id": AdminEvent.id,
        "created_at": AdminEvent.created_at,
        "action": AdminEvent.action,
        "entity": AdminEvent.entity,
    }
    sort_col = sort_map.get(order_by, AdminEvent.created_at)
    stmt = stmt.order_by(sort_col.asc() if direction == "asc" else sort_col.desc())

    stmt = stmt.offset(offset).limit(limit)

    rows = db.execute(stmt).mappings().all()
    return [dict(r) for r in rows]

