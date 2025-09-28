from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models import AdminEvent
from starlette.requests import Request

def log_event(
    db: Session,
    *,
    user_id: Optional[int],
    action: str,
    entity: Optional[str] = None,
    entity_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
):
    ip = None
    ua = None
    try:
        if request:
            xff = request.headers.get("x-forwarded-for")
            ip = (xff.split(",")[0] if xff else request.client.host) if request.client else None
            ua = request.headers.get("user-agent")
    except Exception:
        pass

    ev = AdminEvent(
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        meta=metadata or {},
        ip=ip,
        user_agent=ua,
    )
    db.add(ev)
    db.commit()
