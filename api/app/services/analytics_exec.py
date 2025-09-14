import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from pathlib import Path
from datetime import datetime
import pandas as pd, numpy as np
from sqlalchemy.orm import Session
from app.models import AnalysisRun, RunStatus, Dataset
from app.config import settings
import os, re

STORAGE_ROOT = Path(settings.STORAGE_DIR)
UPLOAD_ROOT  = Path(settings.UPLOAD_DIR)

UPLOAD_ROOT = Path(settings.UPLOAD_DIR).resolve()
ALLOWED_EXTS = {".parquet", ".pq", ".csv", ".tsv", ".txt", ".xlsx", ".xls"}
BASE = settings.PUBLIC_API_BASE.rstrip("/")

def _log(msg, *args):
    print("[analytics]", msg.format(*args))

def _slug(s: str) -> str:
    try:
        return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")
    except Exception:
        return ""

def _pick_best(files: list[Path]) -> Path:
    pref = {".parquet":0, ".pq":0, ".csv":1, ".tsv":2, ".txt":3, ".xlsx":4, ".xls":4}
    files.sort(key=lambda p: (pref.get(p.suffix.lower(), 99), -p.stat().st_size))
    return files[0]

def _dataset_path(ds: Dataset) -> Path:
    """
    Find the dataset file under uploads/<owner_id>/... (your layout),
    with helpful logs at every step. Falls back to a sensible single file
    if no exact match by id/title is found.
    """
    _log("cwd: {}", Path(os.getcwd()).resolve())
    _log("UPLOAD_ROOT: {}", UPLOAD_ROOT)
    _log("dataset id={}, owner_id={}, title={!r}", ds.id, getattr(ds, "owner_id", None), getattr(ds, "title", None))

    for attr in ("file_path", "path", "storage_uri", "local_path"):
        v = getattr(ds, attr, None)
        _log("check attr {} -> {}", attr, v)
        if v:
            p = Path(v)
            _log("  exists={} resolved={}", p.exists(), p.resolve())
            if p.exists():
                _log("using direct path: {}", p)
                return p

    owner_id = str(getattr(ds, "owner_id", "") or "")
    user_dir = (UPLOAD_ROOT / owner_id)
    _log("user_dir {}", user_dir)

    if not user_dir.exists():
        try:
            sample = [str(p) for p in list(UPLOAD_ROOT.iterdir())[:20]]
        except FileNotFoundError:
            sample = ["<uploads dir missing>"]
        _log("user_dir missing. top-level under uploads: {}", sample)
        raise ValueError("Dataset file path not found (user dir missing)")

    def collect(base: Path, limit=5000) -> list[Path]:
        files = []
        for i, p in enumerate(base.rglob("*")):
            if i > limit:
                _log("scan limit {} reached under {}", limit, base)
                break
            try:
                if p.is_file() and p.suffix.lower() in ALLOWED_EXTS:
                    files.append(p)
            except Exception:
                pass
        return files

    id_pat = str(ds.id)
    by_id = [p for p in collect(user_dir) if id_pat in str(p)]
    _log("matches containing dataset id '{}': {}", id_pat, len(by_id))
    if by_id:
        pick = _pick_best(by_id)
        _log("picked by id: {}", pick)
        return pick

    title = getattr(ds, "title", None)
    if title:
        tslug = _slug(title)
        by_title = [p for p in collect(user_dir) if tslug and tslug in str(p).lower()]
        _log("matches containing title slug '{}': {}", tslug, len(by_title))
        if by_title:
            pick = _pick_best(by_title)
            _log("picked by title: {}", pick)
            return pick

    all_files = collect(user_dir)
    _log("fallback candidates under user dir: {}", len(all_files))
    if all_files:
        pick = _pick_best(all_files)
        _log("picked fallback: {}", pick)
        return pick

    _log("_dataset_path FAILED for dataset {} (owner {})", ds.id, owner_id)
    raise ValueError("Dataset file path not found")

def _load_df(p: Path) -> pd.DataFrame:
    s = p.suffix.lower()
    if s in (".csv", ".txt"):
        try:
            return pd.read_csv(p)
        except Exception:
            return pd.read_csv(p, sep="\t")
    if s in (".tsv",):
        return pd.read_csv(p, sep="\t")
    if s in (".parquet", ".pq"):
        return pd.read_parquet(p)
    if s in (".xlsx", ".xls"):
        return pd.read_excel(p)
    return pd.read_csv(p)

def _outdir(run_id: int) -> Path:
    out = STORAGE_ROOT / "runs" / str(run_id)
    out.mkdir(parents=True, exist_ok=True)
    return out
def _u(path: str) -> str:
    return f"{BASE}{path}"

def execute_inline(db: Session, run: AnalysisRun, ds):
    run.status = RunStatus.running
    run.started_at = datetime.utcnow()
    db.commit()

    p = _dataset_path(ds)
    df = _load_df(p)
    outdir = _outdir(run.id)
    arts = {}

    if run.recipe_key == "correlation":
        method = (run.params_json or {}).get("method", "spearman")
        maxf = int((run.params_json or {}).get("max_features", 300))
        sub = df.select_dtypes(include=np.number).iloc[:, :maxf]
        corr = sub.corr(method=method)
        corr.to_csv(outdir/"correlation.csv")
        plt.figure(figsize=(6,5)); plt.imshow(corr.values, aspect="auto")
        plt.colorbar(); plt.title(f"Correlation ({method})")
        plt.tight_layout(); plt.savefig(outdir/"correlation.png"); plt.close()
        arts = {
            "csv_url": _u(f"/files/runs/{run.id}/correlation.csv"),
            "pngs":   [_u(f"/files/runs/{run.id}/correlation.png")],
        }

    elif run.recipe_key == "pca":
        from sklearn.preprocessing import StandardScaler
        from sklearn.decomposition import PCA
        X = df.select_dtypes(include=np.number).valuess
        X = StandardScaler().fit_transform(X)
        n = int((run.params_json or {}).get("n_components",10))
        from math import inf
        n = max(2, min(n, X.shape[1] if X.ndim == 2 else 2))
        pca = PCA(n_components=n)
        scores = pca.fit_transform(X)
        pd.DataFrame(scores[:, :2], columns=["PC1","PC2"]).to_csv(outdir/"pca_scores.csv", index=False)
        plt.figure(); plt.plot(pca.explained_variance_ratio_, marker="o")
        plt.title("PCA Scree"); plt.tight_layout(); plt.savefig(outdir/"pca_scree.png"); plt.close()
        arts = {"scores_csv": f"/files/runs/{run.id}/pca_scores.csv",
                "pngs": [f"/files/runs/{run.id}/pca_scree.png"]}

    elif run.recipe_key == "de":
        from scipy import stats
        group_col = (run.params_json or {}).get("group_col","group")
        if group_col not in df.columns: raise ValueError(f"Column '{group_col}' not in dataset")
        gvals = df[group_col].astype(str)
        groups = gvals.unique()
        if len(groups) != 2: raise ValueError("DE requires exactly 2 groups")
        num = df.select_dtypes(include=np.number)
        res = []
        for col in num.columns:
            a = num[gvals==groups[0]][col].dropna()
            b = num[gvals==groups[1]][col].dropna()
            t, p = stats.ttest_ind(a, b, equal_var=False)
            res.append((col, float(p)))
        out = pd.DataFrame(res, columns=["feature","pval"]).sort_values("pval")
        m = len(out); out["fdr"] = (out["pval"]*m/(np.arange(m)+1)).clip(upper=1.0)
        out.to_csv(outdir/"de.csv", index=False)
        arts = {"csv_url": f"/files/runs/{run.id}/de.csv"}

    else:
        raise ValueError("Unsupported recipe")

    run.artifacts_json = arts
    run.status = RunStatus.succeeded
    run.finished_at = datetime.utcnow()
    db.commit()
