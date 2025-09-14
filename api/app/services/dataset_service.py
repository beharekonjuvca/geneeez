from __future__ import annotations

import os
import re
import uuid
import shutil
from pathlib import Path
from typing import List, Tuple

import pandas as pd
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Dataset, User

UPLOAD_ROOT: Path = Path(settings.UPLOAD_DIR).resolve()


# ---------- Filesystem helpers ----------

def ensure_upload_root() -> None:
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


def _safe_name(name: str) -> str:
    """Make a filename safer for disk use."""
    base = os.path.basename(name or "upload.dat")
    return re.sub(r"[^A-Za-z0-9._-]+", "_", base)


def save_upload(owner_id: int, file: UploadFile) -> Tuple[Path, int]:
    """
    Stream the uploaded file to disk under:
      uploads/<owner_id>/_incoming/<uuid>-<original>
    Returns (absolute_path, size_bytes).
    """
    ensure_upload_root()
    incoming = UPLOAD_ROOT / str(owner_id) / "_incoming"
    incoming.mkdir(parents=True, exist_ok=True)

    unique = f"{uuid.uuid4().hex}-{_safe_name(file.filename)}"
    abs_path = incoming / unique

    size = 0
    with abs_path.open("wb") as out:
        for chunk in iter(lambda: file.file.read(1024 * 1024), b""):
            out.write(chunk)
            size += len(chunk)
    file.file.close()
    return abs_path, size


# ---------- Canonicalization (long -> wide; numeric) ----------

def _read_any(path: Path) -> pd.DataFrame:
    """
    Robust reader:
      - Handles .txt/.tsv/.csv and their .gz variants.
      - GEO Series Matrix: tab-separated; metadata lines start with '!' -> skip via comment='!'.
    """
    name = path.name.lower()

    compression = "infer" if name.endswith(".gz") else None

    if name.endswith(".txt.gz"):
        ext = ".txt"
    elif name.endswith(".tsv.gz"):
        ext = ".tsv"
    elif name.endswith(".csv.gz"):
        ext = ".csv"
    else:
        ext = path.suffix.lower()

    if ext in (".txt", ".tsv"):
        try:
            return pd.read_csv(
                path,
                sep="\t",
                comment="!",
                compression=compression,
                engine="python",  
            )
        except Exception:
            return pd.read_csv(path, compression=compression, engine="python")

    if ext == ".csv":
        return pd.read_csv(path, compression=compression)

    if ext in (".parquet", ".pq"):
        return pd.read_parquet(path)

    if ext in (".xlsx", ".xls"):
        return pd.read_excel(path)

    return pd.read_csv(path, compression=compression, engine="python")
def _is_long(df: pd.DataFrame) -> bool:
    cols = {c.lower() for c in df.columns}
    return (
        {"gene_id", "sample_id", "value"} <= cols
        or {"id_ref", "sample_id", "expression_value"} <= cols
    )


def _to_canonical_wide(df: pd.DataFrame) -> pd.DataFrame:
    cols = {c.lower(): c for c in df.columns}
    gid = cols.get("gene_id") or cols.get("id_ref")
    sid = cols.get("sample_id")
    val = cols.get("value") or cols.get("expression_value")
    wide = df.pivot_table(index=gid, columns=sid, values=val, aggfunc="mean")
    wide.reset_index(inplace=True)
    wide.rename(columns={gid: "gene_id"}, inplace=True)
    return wide


def _coerce_numeric(wide: pd.DataFrame) -> pd.DataFrame:
    """
    Expect canonical wide: first column is gene_id, the rest should be numeric.
    Coerce to numeric, drop all-NaN columns/rows.
    """
    out = wide.copy()
    if out.columns[0].lower() != "gene_id":
        out.rename(columns={out.columns[0]: "gene_id"}, inplace=True)

    for c in out.columns[1:]:
        out[c] = pd.to_numeric(out[c], errors="coerce")

    out = out.dropna(axis=1, how="all")

    if out.shape[1] > 1:
        non_nan_gene = out.iloc[:, 1:].notna().any(axis=1)
        out = out.loc[non_nan_gene]

    return out


def _write_canonical(df: pd.DataFrame, base_dir: Path) -> Path:
    """
    Write canonical matrix under base_dir as matrix.parquet (preferred) or matrix.csv fallback.
    Returns the written file path.
    """
    base_dir.mkdir(parents=True, exist_ok=True)
    try:
        path = base_dir / "matrix.parquet"
        df.to_parquet(path, index=False)
        return path
    except Exception:
        path = base_dir / "matrix.csv"
        df.to_csv(path, index=False)
        return path


def persist_canonical(owner_id: int, dataset_id: int, tmp_path: Path) -> Tuple[Path, int, int]:
    """
    Read uploaded file, convert to canonical wide numeric matrix, save under:
      uploads/<owner_id>/<dataset_id>/matrix.parquet (or .csv fallback)
    Also move the raw file to that dataset folder for provenance.

    Returns (canonical_path, n_rows, n_cols)
    """
    df = _read_any(tmp_path)
    if _is_long(df):
        df = _to_canonical_wide(df)
    df = _coerce_numeric(df)

    dataset_dir = UPLOAD_ROOT / str(owner_id) / str(dataset_id)
    canon_path = _write_canonical(df, dataset_dir)

    try:
        raw_name = f"raw-{_safe_name(tmp_path.name)}"
        shutil.move(str(tmp_path), str(dataset_dir / raw_name))
    except Exception:
        pass
    n_rows = int(max(0, df.shape[0]))
    n_cols = int(max(0, df.shape[1] - 1))
    return canon_path, n_rows, n_cols

def create_dataset(
    db: Session,
    owner: User,
    title: str,
    description: str | None,
    upload: UploadFile,
) -> Dataset:
    """
    1) Save the raw upload.
    2) Create a Dataset row (to get an id).
    3) Build & store the canonical matrix under uploads/<owner>/<dataset_id>/matrix.*.
    4) Update Dataset.storage_path, n_rows, n_cols.
    """
    tmp_path, size = save_upload(owner.id, upload)

    ds = Dataset(
        title=title,
        description=description,
        storage_path=str(tmp_path),
        original_filename=upload.filename,
        mime_type=upload.content_type or None,
        file_size_bytes=size,
        owner_id=owner.id,
        is_public=False,
    )
    db.add(ds)
    db.commit()
    db.refresh(ds) 

    canon_path, n_rows, n_cols = persist_canonical(owner.id, ds.id, tmp_path)
    ds.storage_path = str(canon_path)
    ds.n_rows = n_rows
    ds.n_cols = n_cols
    db.commit()
    db.refresh(ds)
    return ds


def list_datasets(db: Session, owner: User) -> List[Dataset]:
    return (
        db.query(Dataset)
        .filter(Dataset.owner_id == owner.id)
        .order_by(Dataset.created_at.desc())
        .all()
    )


def delete_dataset(db: Session, owner: User, dataset_id: int) -> bool:
    ds = (
        db.query(Dataset)
        .filter(Dataset.id == dataset_id, Dataset.owner_id == owner.id)
        .first()
    )
    if not ds:
        return False

    try:
        p = Path(ds.storage_path)
        dataset_dir = p.parent if p.exists() else (UPLOAD_ROOT / str(owner.id) / str(dataset_id))
        if dataset_dir.exists() and dataset_dir.is_dir():
            shutil.rmtree(dataset_dir, ignore_errors=True)
        else:
            if p.exists():
                p.unlink(missing_ok=True)
    except Exception:
        pass

    db.delete(ds)
    db.commit()
    return True
