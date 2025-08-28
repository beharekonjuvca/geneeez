from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query, Body
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
from app.utils.dataread import read_table_any, dtype_of, guess_role, scan_any
from app.utils.filters import apply_filters, apply_filters_pl
from app.utils.cache import cache, make_key
import polars as pl

def _file_signature(path: str) -> dict:
    try:
        stat = os.stat(path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found on server")
    return {"size": stat.st_size, "mtime": int(stat.st_mtime)}


def _cache_key(dataset_id: int, sig: dict, kind: str) -> dict:
    return {"dataset_id": dataset_id, "kind": kind, "sig": sig}
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

@router.post("/datasets/{dataset_id}/chart")
def dataset_chart(
    dataset_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    ds = (
        db.query(Dataset)
        .filter(Dataset.id == dataset_id, Dataset.owner_id == user.id)
        .first()
    )
    if not ds:
        raise HTTPException(404, "Dataset not found")

    key = make_key(dataset_id, payload)
    if key in cache:
        return cache[key]

    kind = payload.get("kind")
    x = payload.get("x")
    y = payload.get("y")
    bins = int(payload.get("bins", 20))
    agg = payload.get("agg", "sum")
    filters = payload.get("filters", [])
    sample = int(payload.get("sample", 0))

    ldf = scan_any(ds.storage_path)

    ldf = apply_filters_pl(ldf, filters)

    if sample:
        ldf = ldf.sample(n=sample, shuffle=True, seed=42)

    needed = [c for c in {x, y} if c]
    if needed:
        ldf = ldf.select([pl.col(c) for c in needed])

    if kind == "hist":
        if not x:
            raise HTTPException(400, "Column not found")

        t = ldf.select(pl.col(x).cast(pl.Float64).alias("_x")).drop_nulls(["_x"])

        stats = (
            t.select([pl.col("_x").min().alias("min"), pl.col("_x").max().alias("max")])
            .collect()
            .row(0)
        )
        minv, maxv = float(stats[0]), float(stats[1])

        if not (minv < maxv):
            out = {"kind": "hist", "edges": [minv, maxv], "counts": [0]}
            cache[key] = out
            return out

        b = max(5, min(50, bins))
        edges = [minv + (maxv - minv) * i / b for i in range(b + 1)]

        bin_expr = (
            ((pl.col("_x") - minv) / (maxv - minv) * b)
            .floor()
            .clip(0, b - 1)
            .cast(pl.Int64)
            .alias("bin")
        )

        agg = t.select(bin_expr).group_by("bin").len().collect()
        counts_map = {int(a): int(b) for a, b in agg.iter_rows()}
        counts = [counts_map.get(i, 0) for i in range(b)]

        res = {"kind": "hist", "edges": edges, "counts": counts}
        cache[key] = res
        return res

    if kind == "bar":
        if not x:
            raise HTTPException(400, "X not found")

        if y:
            g = ldf.group_by(x)
            if agg == "mean":
                ag = g.agg(pl.col(y).mean().alias("y"))
            elif agg == "count":
                ag = g.agg(pl.count().alias("y"))
            else:
                ag = g.agg(pl.col(y).sum().alias("y"))
            ag = ag.sort("y", descending=True).limit(50).collect()
            data = [{"x": str(a), "y": float(b)} for a, b in ag.select([x, "y"]).iter_rows()]
        else:
            vc = ldf.group_by(x).len().sort("len", descending=True).limit(50).collect()
            data = [{"x": str(a), "y": int(b)} for a, b in vc.iter_rows()]

        res = {"kind": "bar", "data": data}
        cache[key] = res
        return res

    if kind == "line":
        if not x or not y:
            raise HTTPException(400, "X or Y not found")

        try:
            xx = pl.col(x).str.strptime(pl.Datetime, strict=True, exact=False, infer_dtype=True)
            tdf = ldf.with_columns(xx.alias("_x")).drop_nulls("_x")
        except Exception:
            tdf = ldf.with_columns(pl.col(x).cast(pl.Float64).alias("_x")).drop_nulls("_x")

        ag = (
            tdf.group_by("_x")
            .agg(pl.col(y).mean().alias("y"))
            .sort("_x")
            .limit(2000)
            .collect()
        )
        data = [
            {"x": (a.isoformat() if hasattr(a, "isoformat") else float(a)), "y": float(b)}
            for a, b in ag.iter_rows()
        ]
        res = {"kind": "line", "data": data}
        cache[key] = res
        return res

    if kind == "scatter":
        if not x or not y:
            raise HTTPException(400, "X or Y not found")

        max_pts = min(sample or 5000, 5000)

        t = (
            ldf.select([
                pl.col(x).cast(pl.Float64, strict=False).alias("_x_num"),
                pl.col(y).cast(pl.Float64, strict=False).alias("_y_num"),

                pl.col(x)
                .cast(pl.Utf8, strict=False)
                .str.strptime(pl.Datetime, strict=False, exact=False)
                .dt.timestamp("s")
                .cast(pl.Float64, strict=False)
                .alias("_x_ts"),
            ])
            .select([
                pl.coalesce([pl.col("_x_num"), pl.col("_x_ts")]).alias("x"),
                pl.col("_y_num").alias("y"),
            ])
            .drop_nulls(["x", "y"])
            .sample(n=max_pts, shuffle=True, seed=42)
            .collect()
        )

        if t.height == 0:
            res = {"kind": "scatter", "data": []}
            cache[key] = res; return res

        data = [{"x": float(a), "y": float(b)} for a, b in t.iter_rows()]
        res = {"kind": "scatter", "data": data}
        cache[key] = res
        return res

    raise HTTPException(400, "Unknown chart kind")