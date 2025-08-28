import os
import polars as pl

def read_table_any(path: str) -> pl.DataFrame:
    if path.endswith(".parquet"):
        return pl.read_parquet(path)
    if path.endswith(".csv"):
        return pl.read_csv(path, infer_schema_length=2000)
    if path.endswith(".xlsx"):
        return pl.read_excel(path)
    raise ValueError(f"Unsupported file: {path}")

def write_parquet(df: pl.DataFrame, out_path: str) -> str:
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    df.write_parquet(out_path, compression="zstd")
    return out_path
