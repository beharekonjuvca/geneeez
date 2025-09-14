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
    compression = "infer" if p.suffix.lower() == ".gz" or str(p).endswith(".txt.gz") else None
    name = p.name
    if name.endswith(".txt.gz"):
        ext = ".txt"
    elif name.endswith(".tsv.gz"):
        ext = ".tsv"
    elif name.endswith(".csv.gz"):
        ext = ".csv"
    else:
        ext = p.suffix.lower()

    if ext in (".txt", ".tsv"):
        return pd.read_csv(
            p, sep="\t", comment="!", compression=compression, engine="python"
        )

    if ext in (".csv",):
        return pd.read_csv(p, compression=compression)

    if ext in (".parquet", ".pq"):
        return pd.read_parquet(p)

    if ext in (".xlsx", ".xls"):
        return pd.read_excel(p)

    return pd.read_csv(p, compression=compression)


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
        from scipy.cluster.hierarchy import linkage, leaves_list
        method = (run.params_json or {}).get("method", "spearman")
        mode   = (run.params_json or {}).get("axis", "samples")  
        max_n  = int((run.params_json or {}).get("max_n", 300))
        do_cluster = bool((run.params_json or {}).get("cluster", True))

        num = df.select_dtypes(include=np.number)

        if mode == "samples":
            X = num.iloc[:, :max_n]                
            corr = X.corr(method=method)
        else:  
            X = num.T                            
            keep = X.var(axis=0, skipna=True).nlargest(max_n).index
            corr = X[keep].corr(method=method)

        if do_cluster and corr.shape[0] > 2:
            order = leaves_list(linkage(corr.fillna(0.0).values, method="average"))
            corr = corr.iloc[order, order]

        outdir = _outdir(run.id)
        corr.to_csv(outdir / "correlation.csv")
        plt.figure(figsize=(6,5))
        plt.imshow(corr.values, aspect="auto")
        plt.colorbar(); plt.title(f"Correlation ({method})")
        plt.tight_layout(); plt.savefig(outdir / "correlation.png"); plt.close()

        arts = {
            "csv_url": _u(f"/files/runs/{run.id}/correlation.csv"),
            "pngs":   [_u(f"/files/runs/{run.id}/correlation.png")],
        }

    elif run.recipe_key == "pca":
        from sklearn.preprocessing import StandardScaler
        from sklearn.decomposition import PCA

        p = run.params_json or {}
        n_req      = int(p.get("n_components", 10))
        top_genes  = int(p.get("top_genes", 1000))   
        use_log1p  = bool(p.get("log1p", False))     

        num_df = df.select_dtypes(include=np.number).copy()     
        sample_ids = list(num_df.columns)

        if use_log1p:
            num_df = np.log1p(num_df)

        # choose top-N variable genes (rows) by variance across samples
        # use df['gene_id'] when present to carry gene names into loadings
        if "gene_id" in df.columns and df.columns[0].lower() == "gene_id":
            gene_ids_all = df["gene_id"].astype(str)
        else:
            # fallback: synthetic gene ids if not present
            gene_ids_all = pd.Index([f"gene_{i}" for i in range(len(df))], name="gene_id")

        # Align gene ids with numeric subset (same row order as df)
        # num_df has the same index as df
        variances = num_df.var(axis=1, skipna=True)
        k = int(min(top_genes, len(variances)))
        keep_idx = variances.nlargest(k).index
        M = num_df.loc[keep_idx]                   
        kept_gene_ids = gene_ids_all.loc[keep_idx].astype(str).to_numpy()

        X = M.T.values                             

        Xz = StandardScaler(with_mean=True, with_std=True).fit_transform(X)

        # n cannot exceed min(n_samples, n_features)
        n = max(2, min(n_req, Xz.shape[0], Xz.shape[1]))

        pca = PCA(n_components=n, svd_solver="auto", random_state=0)
        scores   = pca.fit_transform(Xz)          
        loadings = pca.components_.T               
        evr      = pca.explained_variance_ratio_   

        outdir = _outdir(run.id)

        # 1) scores per sample with sample_id
        scores_df = pd.DataFrame(scores, columns=[f"PC{i+1}" for i in range(n)])
        scores_df.insert(0, "sample_id", sample_ids)
        scores_df.to_csv(outdir / "pca_scores.csv", index=False)

        # 2) loadings per gene with gene_id
        load_df = pd.DataFrame(loadings, columns=[f"PC{i+1}" for i in range(n)])
        load_df.insert(0, "gene_id", kept_gene_ids)
        load_df.to_csv(outdir / "pca_loadings.csv", index=False)

        # 3) explained variance (+ cumulative) per PC
        explained_df = pd.DataFrame({
            "pc":        [f"PC{i+1}" for i in range(n)],
            "explained": evr,
            "cumulative": np.cumsum(evr)
        })
        explained_df.to_csv(outdir / "pca_explained.csv", index=False)

        # Scree with cumulative
        plt.figure()
        x = np.arange(1, n + 1)
        plt.plot(x, evr, marker="o", label="Explained")
        plt.plot(x, np.cumsum(evr), marker="o", linestyle="--", label="Cumulative")
        plt.xlabel("Principal component")
        plt.ylabel("Explained variance ratio")
        plt.title("PCA Scree")
        plt.legend()
        plt.tight_layout()
        plt.savefig(outdir / "pca_scree.png")
        plt.close()

        pc1_pct = round(100 * evr[0], 1) if n >= 1 else 0.0
        pc2_pct = round(100 * evr[1], 1) if n >= 2 else 0.0

        plt.figure()
        plt.scatter(scores[:, 0], scores[:, 1], s=12)
        plt.xlabel(f"PC1 ({pc1_pct}%)")
        plt.ylabel(f"PC2 ({pc2_pct}%)")
        plt.title("PCA (samples)")
        plt.tight_layout()
        plt.savefig(outdir / "pca_scatter.png")
        plt.close()

        arts = {
            "scores_csv":    _u(f"/files/runs/{run.id}/pca_scores.csv"),
            "loadings_csv":  _u(f"/files/runs/{run.id}/pca_loadings.csv"),
            "explained_csv": _u(f"/files/runs/{run.id}/pca_explained.csv"),
            "pngs": [
                _u(f"/files/runs/{run.id}/pca_scree.png"),
                _u(f"/files/runs/{run.id}/pca_scatter.png"),
            ],
        }

        from sklearn.preprocessing import StandardScaler
        from sklearn.decomposition import PCA

        p = run.params_json or {}
        n = int(p.get("n_components", 10))
        top_genes = int(p.get("top_genes", 1000))     
        use_log1p = bool(p.get("log1p", False))       

        M = df.select_dtypes(include=np.number).copy()
        if use_log1p:
            M = np.log1p(M)

        # keep top-N variable genes (rows if genes are rows; if genes are columns, transpose)
        # Our canonical matrix is genes in rows, samples in columns (first col 'gene_id').
        if "gene_id" in df.columns and df.columns[0].lower() == "gene_id":
            genes = df["gene_id"].astype(str).values
            X = M.values  
            if X.shape[0] > top_genes:
                keep_idx = np.argsort(X.var(axis=1))[-top_genes:]
                X = X[keep_idx, :]
                genes = genes[keep_idx]
            X = StandardScaler(with_mean=True, with_std=True).fit_transform(X)
            Xs = X.T
            pca = PCA(n_components=max(2, min(n, Xs.shape[1])))
            scores = pca.fit_transform(Xs)  
            loadings = pca.components_.T   
            pd.DataFrame(
                scores[:, :2], columns=["PC1","PC2"]
            ).to_csv(outdir/"pca_scores.csv", index=False)
            pd.DataFrame(
                loadings, index=genes, columns=[f"PC{i+1}" for i in range(pca.n_components_)]
            ).to_csv(outdir/"pca_loadings.csv")
        else:
            X = M.values.T
            X = StandardScaler(with_mean=True, with_std=True).fit_transform(X)
            pca = PCA(n_components=max(2, min(n, X.shape[1])))
            scores = pca.fit_transform(X)
            pd.DataFrame(scores[:, :2], columns=["PC1","PC2"]).to_csv(outdir/"pca_scores.csv", index=False)

        evr = pca.explained_variance_ratio_
        pc1_pct = round(100*evr[0], 1)
        pc2_pct = round(100*evr[1], 1)

        # Scree + cumulative
        plt.figure()
        x = np.arange(1, len(evr)+1)
        plt.plot(x, evr, marker="o", label="Explained")
        plt.plot(x, np.cumsum(evr), marker="o", linestyle="--", label="Cumulative")
        plt.xlabel("Principal component"); plt.ylabel("Explained variance ratio")
        plt.title("PCA Scree"); plt.legend(); plt.tight_layout()
        plt.savefig(outdir/"pca_scree.png"); plt.close()

        # Scatter
        plt.figure()
        plt.scatter(scores[:,0], scores[:,1], s=12)
        plt.xlabel(f"PC1 ({pc1_pct}%)"); plt.ylabel(f"PC2 ({pc2_pct}%)")
        plt.title("PCA (samples)"); plt.tight_layout()
        plt.savefig(outdir/"pca_scatter.png"); plt.close()

        arts = {
            "scores_csv": f"/files/runs/{run.id}/pca_scores.csv",
            "loadings_csv": f"/files/runs/{run.id}/pca_loadings.csv",
            "explained_csv": f"/files/runs/{run.id}/pca_explained.csv",
            "pngs": [
                f"/files/runs/{run.id}/pca_scree.png",
                f"/files/runs/{run.id}/pca_scatter.png",
            ],
        }

        from sklearn.preprocessing import StandardScaler
        from sklearn.decomposition import PCA

        num_df = df.select_dtypes(include=np.number)

        X = num_df.T.values  

        X = StandardScaler(with_mean=True, with_std=True).fit_transform(X)

        req_n = int((run.params_json or {}).get("n_components", 10))
        n = max(2, min(req_n, X.shape[1]))  

        pca = PCA(n_components=n, svd_solver="auto", random_state=0)
        scores = pca.fit_transform(X)  

        # Save PC1/PC2 coordinates per sample
        pc12 = pd.DataFrame(scores[:, :2], columns=["PC1", "PC2"])
        pc12.to_csv(outdir / "pca_scores.csv", index=False)

        # Scree plot
        plt.figure()
        plt.plot(np.arange(1, n + 1), pca.explained_variance_ratio_, marker="o")
        plt.xlabel("Principal component")
        plt.ylabel("Explained variance ratio")
        plt.title("PCA Scree")
        plt.tight_layout()
        plt.savefig(outdir / "pca_scree.png")
        plt.close()

        # Scatter of PC1 vs PC2 (samples)
        plt.figure()
        plt.scatter(pc12["PC1"], pc12["PC2"], s=12)
        plt.xlabel("PC1")
        plt.ylabel("PC2")
        plt.title("PCA (samples)")
        plt.tight_layout()
        plt.savefig(outdir / "pca_scatter.png")
        plt.close()

        arts = {
            "scores_csv": _u(f"/files/runs/{run.id}/pca_scores.csv"),
            "pngs": [
                _u(f"/files/runs/{run.id}/pca_scree.png"),
                _u(f"/files/runs/{run.id}/pca_scatter.png"),
            ],
            "explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
        }

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
