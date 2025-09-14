from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import DatasetCreate, DatasetOut
from app.utils.deps import current_user
from app.services.dataset_service import create_dataset, list_datasets, delete_dataset

router = APIRouter()

@router.get("", response_model=List[DatasetOut])
def get_my_datasets(db: Session = Depends(get_db), user: User = Depends(current_user)):
    items = list_datasets(db, user)
    return items

@router.post("/upload", response_model=DatasetOut)
async def upload_dataset(
    title: str = Form(...),
    description: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    allowed = {
    "text/csv",
    "text/plain",                     
    "application/gzip",               
    "application/x-gzip",             
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    ds = create_dataset(db, user, title=title, description=description, upload=file)
    return ds

@router.delete("/{dataset_id}", status_code=204)
def remove_dataset(dataset_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    ok = delete_dataset(db, user, dataset_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Dataset not found")
