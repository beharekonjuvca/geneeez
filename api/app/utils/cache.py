from cachetools import TTLCache
from functools import lru_cache

cache = TTLCache(maxsize=512, ttl=300)

def make_key(dataset_id: int, payload: dict) -> str:
    import json, hashlib
    s = json.dumps({"id": dataset_id, "payload": payload}, sort_keys=True, default=str)
    return hashlib.md5(s.encode()).hexdigest()
