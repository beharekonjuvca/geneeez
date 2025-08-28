from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from datetime import datetime
from app.db import get_db
from app.models import Dataset, User
from app.utils.deps import current_user
from app.mongo import get_mongo

router = APIRouter()

@router.get("/recipes")
def list_recipes(
    dataset_id: int = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == user.id).first()
    if not ds: raise HTTPException(404, "Dataset not found")
    m = get_mongo()
    cur = m.recipes.find({"dataset_id": dataset_id, "owner_id": user.id, "kind": "viz_panels"}).sort("updated_at", -1)
    return [{"id": str(x["_id"]), "name": x.get("name"), "panels": x.get("panels", []), "updated_at": x["updated_at"].isoformat()} for x in cur]

@router.post("/recipes")
def create_recipe(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    dataset_id = body.get("dataset_id")
    panels = body.get("panels", [])
    name = body.get("name") or "Untitled"
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == user.id).first()
    if not ds: raise HTTPException(404, "Dataset not found")
    doc = {
        "owner_id": user.id,
        "dataset_id": dataset_id,
        "kind": "viz_panels",
        "name": name,
        "panels": panels,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    m = get_mongo()
    res = m.recipes.insert_one(doc)
    return {"id": str(res.inserted_id)}

@router.put("/recipes/{rid}")
def update_recipe(
    rid: str,
    body: dict = Body(...),  
    user: User = Depends(current_user),
):
    m = get_mongo()
    doc = m.recipes.find_one({"_id": m.ObjectId(rid)}) if hasattr(m, "ObjectId") else None 
    from bson import ObjectId
    oid = ObjectId(rid)
    doc = m.recipes.find_one({"_id": oid})
    if not doc or doc["owner_id"] != user.id:
        raise HTTPException(404, "Recipe not found")
    upd = {"updated_at": datetime.utcnow()}
    if "name" in body: upd["name"] = body["name"]
    if "panels" in body: upd["panels"] = body["panels"]
    m.recipes.update_one({"_id": oid}, {"$set": upd})
    return {"ok": True}

@router.delete("/recipes/{rid}")
def delete_recipe(rid: str, user: User = Depends(current_user)):
    from bson import ObjectId
    m = get_mongo()
    doc = m.recipes.find_one({"_id": ObjectId(rid)})
    if not doc or doc["owner_id"] != user.id:
        raise HTTPException(404, "Recipe not found")
    m.recipes.delete_one({"_id": ObjectId(rid)})
    return {"ok": True}
