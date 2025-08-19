from pymongo import MongoClient
from app.config import settings

_client = None
_db = None

def get_mongo():
    global _client, _db
    if _client is None:
        _client = MongoClient(settings.MONGODB_URI)
        _db = _client[settings.MONGODB_DB]
    return _db
