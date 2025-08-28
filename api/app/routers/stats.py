from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Dataset, User
from app.utils.deps import current_user
from app.utils.io_polars import read_table_any
from app.utils.filters import apply_filters
from app.utils.cache import cache, make_key
import polars as pl
import numpy as np

router = APIRouter()

@router.post("/datasets/{dataset_id}/stats/corr")
def corr_matrix(dataset_id: int,
                body: dict = Body(...),
                db: Session = Depends(get_db),
                user: User = Depends(current_user)):
    ds = db.query(Dataset).filter(Dataset.id==dataset_id, Dataset.owner_id==user.id).first()
    if not ds: raise HTTPException(404, "Dataset not found")

    key = make_key(dataset_id, {"corr": body})
    if key in cache: return cache[key]

    df = read_table_any(ds.storage_path)
    df = apply_filters(df, body.get("filters"))
    cols = body.get("columns")
    if cols: df = df.select([c for c in cols if c in df.columns])

    num = df.select([pl.col(c).cast(pl.Float64) for c in df.columns]).drop_nulls()
    if num.width == 0 or num.height == 0:
        out = {"cols": [], "matrix": []}
        cache[key] = out; return out

    arr = np.array(num.to_numpy(), dtype=float)
    mat = np.corrcoef(arr, rowvar=False)
    out = {"cols": num.columns, "matrix": mat.tolist()}
    cache[key] = out
    return out

@router.post("/datasets/{dataset_id}/stats/pca")
def pca_scores(dataset_id: int,
               body: dict = Body(...),
               db: Session = Depends(get_db),
               user: User = Depends(current_user)):
    ds = db.query(Dataset).filter(Dataset.id==dataset_id, Dataset.owner_id==user.id).first()
    if not ds: raise HTTPException(404, "Dataset not found")

    key = make_key(dataset_id, {"pca": body})
    if key in cache: return cache[key]

    df = read_table_any(ds.storage_path)
    df = apply_filters(df, body.get("filters"))
    cols = body.get("columns") or []
    if not cols:
        cand = [c for c in df.columns if df[c].dtype in (pl.Float64, pl.Float32, pl.Int64, pl.Int32)]
        cols = cand[:20]
    num = df.select([pl.col(c).cast(pl.Float64) for c in cols]).drop_nulls()
    if num.height < 3 or num.width < 2:
        out = {"scores": [], "explained": []}
        cache[key] = out; return out

    import numpy as np
    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA

    X = np.array(num.to_numpy(), dtype=float)
    Z = StandardScaler().fit_transform(X)
    k = int(body.get("n_components", 2))
    pca = PCA(n_components=max(2, k)).fit(Z)
    S = pca.transform(Z)
    scores = [{"pc1": float(a), "pc2": float(b)} for a,b in S[:, :2]]
    out = {"scores": scores, "explained": pca.explained_variance_ratio_[:2].tolist(), "columns": cols}
    cache[key] = out
    return out
