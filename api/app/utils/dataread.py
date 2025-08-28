import os
import pandas as pd
import polars as pl
READ_MAX_ROWS = 200_000

def read_table_any(path: str, nrows: int | None = None) -> pd.DataFrame:
    ext = os.path.splitext(path)[1].lower()
    kwargs = {}
    if nrows:
        kwargs["nrows"] = nrows
    if ext in [".csv", ".tsv", ".txt"]:
        sep = "," if ext == ".csv" else ("\t" if ext == ".tsv" else None)
        return pd.read_csv(path, sep=sep, **kwargs)
    elif ext in [".xls", ".xlsx"]:
        return pd.read_excel(path, engine="openpyxl", **kwargs)
    else:
        raise ValueError(f"Unsupported file extension: {ext}")

def guess_role(series: pd.Series) -> str:
    name = (series.name or "").lower()
    nunique = series.nunique(dropna=True)
    n = len(series)
    if "id" in name or (nunique > 0.9 * n and series.dtype == "object"):
        return "id"
    if series.dtype == "object" and nunique <= 20:
        return "label"
    return "feature"

def dtype_of(series: pd.Series) -> str:
    if pd.api.types.is_integer_dtype(series): return "integer"
    if pd.api.types.is_float_dtype(series): return "number"
    if pd.api.types.is_bool_dtype(series): return "boolean"
    if pd.api.types.is_datetime64_any_dtype(series): return "datetime"
    return "string"
def scan_any(path: str) -> pl.LazyFrame:
    ext = os.path.splitext(path)[1].lower()
    if ext in (".parquet", ".pq"):
        return pl.scan_parquet(path)
    if ext in (".csv", ".tsv"):
        sep = "\t" if ext == ".tsv" else ","
        return pl.scan_csv(path, separator=sep, infer_schema_length=1000)
    if ext in (".ndjson", ".jsonl"):
        return pl.scan_ndjson(path)
    return pl.from_pandas(pd.read_excel(path)).lazy()
