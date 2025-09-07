import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from pathlib import Path
from datetime import datetime
import pandas as pd, numpy as np
from sqlalchemy.orm import Session
from app.models import AnalysisRun, RunStatus
from app.config import settings

STORAGE_ROOT = Path(settings.STORAGE_DIR)
UPLOAD_ROOT  = Path(settings.UPLOAD_DIR)

def _dataset_path(ds) -> Path:
    
    for attr in ("file_path", "path", "storage_uri", "local_path"):
        v = getattr(ds, attr, None)
        if v:
            p = Path(v)
            if p.exists():
                return p

    if UPLOAD_ROOT.exists():
        for pat in (f"{ds.id}.*", f"*{ds.id}*"):
            for p in UPLOAD_ROOT.rglob(pat):
                if p.is_file():
                    return p

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
        arts = {"csv_url": f"/files/runs/{run.id}/correlation.csv",
                "pngs": [f"/files/runs/{run.id}/correlation.png"]}

    elif run.recipe_key == "pca":
        from sklearn.preprocessing import StandardScaler
        from sklearn.decomposition import PCA
        X = df.select_dtypes(include=np.number).values
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
