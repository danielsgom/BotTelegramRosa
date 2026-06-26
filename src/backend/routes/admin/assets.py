"""
Admin predefined assets routes.
"""

import logging
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from config import get_settings
from database import PredefinedAsset, get_db
from dependencies import verify_api_token
from utils import datetime_to_iso_madrid

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/admin/predefined-assets", tags=["admin-assets"])


@router.get("")
async def get_predefined_assets(
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
    asset_type: Optional[str] = None,
    category: Optional[str] = None,
):
    try:
        query = db.query(PredefinedAsset)
        if asset_type:
            query = query.filter(PredefinedAsset.asset_type == asset_type)
        if category:
            query = query.filter(PredefinedAsset.category == category)

        assets = query.order_by(PredefinedAsset.created_at.desc()).all()

        return {
            "success": True,
            "assets": [
                {
                    "id": a.id,
                    "name": a.name,
                    "asset_type": a.asset_type,
                    "file_url": a.file_url,
                    "link_url": a.link_url,
                    "category": a.category,
                    "description": a.description,
                    "created_at": datetime_to_iso_madrid(a.created_at),
                }
                for a in assets
            ],
        }
    except Exception as e:
        logger.error(f"Error getting predefined assets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_predefined_asset(
    name: str = Form(...),
    asset_type: str = Form(...),
    category: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    link_url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        existing = db.query(PredefinedAsset).filter(PredefinedAsset.name == name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Asset name already exists")

        file_url = None
        if file:
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
            filename = f"{datetime.utcnow().timestamp()}_{file.filename}"
            filepath = os.path.join(settings.UPLOAD_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(await file.read())
            file_url = f"/uploads/{filename}"

        asset = PredefinedAsset(
            name=name,
            asset_type=asset_type,
            file_url=file_url,
            link_url=link_url if asset_type == "link" else None,
            category=category,
            description=description,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        logger.info(f"Predefined asset created: {asset.id} ({name})")
        return {"success": True, "asset_id": asset.id, "name": asset.name}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating predefined asset: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{asset_id}")
async def delete_predefined_asset(
    asset_id: int,
    token: str = Depends(verify_api_token),
    db: Session = Depends(get_db),
):
    try:
        asset = db.query(PredefinedAsset).filter(PredefinedAsset.id == asset_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")

        db.delete(asset)
        db.commit()

        logger.info(f"Predefined asset {asset_id} deleted")
        return {"success": True, "message": "Asset deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting predefined asset {asset_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
