from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
import os
import hashlib
import pandas as pd
from typing import Optional
from fastapi import Response
from fastapi.responses import StreamingResponse
import io
import pandas as pd
from app.utils.dataread import read_table_any
from app.db import get_db
from app.models import Dataset, User
from app.utils.deps import current_user
from app.mongo import get_mongo
from app.utils.dataread import read_table_any, dtype_of, guess_role

router = APIRouter()

def _file_signature(path: str) -> dict:
    try:
        stat = os.stat(path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found on server")
    return {"size": stat.st_size, "mtime": int(stat.st_mtime)}

def _cache_key(dataset_id: int, sig: dict, kind: str) -> dict:
    return {"dataset_id": dataset_id, "kind": kind, "sig": sig}

@router.get("/datasets/{dataset_id}/preview")
def dataset_preview(
    dataset_id: int,
    rows: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == user.id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    sig = _file_signature(ds.storage_path)
    mongo = get_mongo()
    key = _cache_key(dataset_id, sig, "preview")
    cached = mongo.caches.find_one(key, {"_id": 0})
    if cached:
        return cached["payload"]

    try:
        df = read_table_any(ds.storage_path, nrows=rows)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    cols = df.columns.tolist()
    data_rows = df.where(pd.notnull(df), None).values.tolist()

    payload = {"columns": cols, "rows": data_rows}
    mongo.caches.update_one(key, {"$set": {"payload": payload, "created_at": datetime.utcnow()}}, upsert=True)
    return payload

@router.get("/datasets/{dataset_id}/schema")
def dataset_schema(
    dataset_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == user.id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    sig = _file_signature(ds.storage_path)
    mongo = get_mongo()
    key = _cache_key(dataset_id, sig, "schema")
    cached = mongo.caches.find_one(key, {"_id": 0})
    if cached:
        return cached["payload"]

    try:
        sample = read_table_any(ds.storage_path, nrows=20000)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    out = []
    n = len(sample)
    for col in sample.columns:
        s = sample[col]
        if s.dtype == "object":
            try:
                s_dt = pd.to_datetime(s, errors="raise", infer_datetime_format=True)
                s = s_dt
                sample[col] = s_dt
            except Exception:
                pass

        dtype = dtype_of(s)
        missing = int(s.isna().sum())
        uniq = int(s.nunique(dropna=True))
        role = guess_role(s)
        missing_pct = (missing / n * 100.0) if n else 0.0

        out.append({
            "name": col,
            "dtype": dtype,
            "missing": missing,
            "missing_pct": round(missing_pct, 2),
            "unique_count": uniq,
            "role": role,
        })

    payload = {"rows": n, "columns": out}
    mongo.caches.update_one(key, {"$set": {"payload": payload, "created_at": datetime.utcnow()}}, upsert=True)
    return payload
@router.get("/datasets/{dataset_id}/download")
def download_dataset(
    dataset_id: int,
    format: str = "csv",                
    columns: Optional[str] = None,       
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == user.id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        df = read_table_any(ds.storage_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    if columns:
        cols = [c for c in columns.split(",") if c in df.columns]
        if not cols:
            raise HTTPException(status_code=400, detail="No requested columns found")
        df = df[cols]

    title = (ds.title or f"dataset_{dataset_id}").replace(" ", "_")

    if format == "csv":
        buf = io.StringIO()
        df.to_csv(buf, index=False)
        data = buf.getvalue().encode("utf-8")
        return StreamingResponse(
            io.BytesIO(data),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{title}.csv"'},
        )
    elif format == "xlsx":
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="data")
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{title}.xlsx"'},
        )
    elif format == "json":
        data = df.to_json(orient="records")
        return StreamingResponse(
            io.BytesIO(data.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{title}.json"'},
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported format")