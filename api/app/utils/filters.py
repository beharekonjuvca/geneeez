import polars as pl
import json
from typing import List, Dict, Any

def _to_list(v):
    if isinstance(v, list): return v
    try:
        j = json.loads(v)
        if isinstance(j, list): return j
    except Exception:
        pass
    return [v]

def apply_filters(df: pl.DataFrame, filters: List[Dict[str, Any]] | None) -> pl.DataFrame:
    if not filters:
        return df
    exprs = []
    for f in filters:
        col = f.get("column")
        op  = f.get("op")
        val = f.get("value")
        if col not in df.columns:
            continue
        s = pl.col(col)
        if op in ("==","!=","<","<=",">",">="):
            exprs.append(eval(f"s {op} {repr(val)}"))
        elif op == "contains":
            exprs.append(s.cast(pl.Utf8).str.contains(str(val)).fill_null(False))
        elif op == "in":
            exprs.append(s.is_in(_to_list(val)))
        elif op == "between":
            a, b = val
            exprs.append(s.is_between(a, b, closed="both"))
    if not exprs:
        return df
    cond = exprs[0]
    for e in exprs[1:]:
        cond = cond & e
    return df.filter(cond)
import polars as pl
from typing import List, Dict, Any

def _to_list(v):
    return v if isinstance(v, list) else [v]

def apply_filters_pl(ldf: pl.LazyFrame, filters: List[Dict[str, Any]] | None) -> pl.LazyFrame:
    if not filters:
        return ldf
    exprs = []
    for f in filters:
        col = f.get("column") or f.get("col")
        op  = f.get("op")
        val = f.get("value")
        if col is None or col not in ldf.columns:
            continue
        s = pl.col(col)
        if op == "==":        exprs.append(s == val)
        elif op == "!=":      exprs.append(s != val)
        elif op == "<":       exprs.append(s <  val)
        elif op == "<=":      exprs.append(s <= val)
        elif op == ">":       exprs.append(s >  val)
        elif op == ">=":      exprs.append(s >= val)
        elif op == "contains":exprs.append(s.cast(pl.Utf8).str.contains(str(val)).fill_null(False))
        elif op == "in":      exprs.append(s.is_in(_to_list(val)))
        elif op == "between":
            a, b = val
            exprs.append(s.is_between(a, b, closed="both"))
    if not exprs:
        return ldf
    cond = exprs[0]
    for e in exprs[1:]:
        cond = cond & e
    return ldf.filter(cond)
