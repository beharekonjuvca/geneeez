import os
import uuid
from typing import Iterable, List
from sqlalchemy.orm import Session
from fastapi import UploadFile

from app.models import Dataset, User

UPLOAD_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))

def ensure_upload_root():
    os.makedirs(UPLOAD_ROOT, exist_ok=True)

def save_upload(owner_id: int, file: UploadFile) -> tuple[str, int]:
    """Save the uploaded file under uploads/<owner_id>/<uuid>-<orig> and return (path, size)."""
    ensure_upload_root()
    owner_dir = os.path.join(UPLOAD_ROOT, str(owner_id))
    os.makedirs(owner_dir, exist_ok=True)

    unique_name = f"{uuid.uuid4().hex}-{file.filename}"
    abs_path = os.path.join(owner_dir, unique_name)

    size = 0
    with open(abs_path, "wb") as f:
        for chunk in iter(lambda: file.file.read(1024 * 1024), b""):
            f.write(chunk)
            size += len(chunk)
    file.file.close()
    return abs_path, size

def create_dataset(
    db: Session,
    owner: User,
    title: str,
    description: str | None,
    upload: UploadFile,
) -> Dataset:
    path, size = save_upload(owner.id, upload)
    ds = Dataset(
        title=title,
        description=description,
        storage_path=path,
        original_filename=upload.filename,
        mime_type=upload.content_type or None,
        file_size_bytes=size,
        owner_id=owner.id,
        is_public=False,
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)
    return ds

def list_datasets(db: Session, owner: User) -> List[Dataset]:
    return db.query(Dataset).filter(Dataset.owner_id == owner.id).order_by(Dataset.created_at.desc()).all()

def delete_dataset(db: Session, owner: User, dataset_id: int) -> bool:
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == owner.id).first()
    if not ds:
        return False
    try:
        if os.path.exists(ds.storage_path):
            os.remove(ds.storage_path)
    except Exception:
        pass
    db.delete(ds)
    db.commit()
    return True
