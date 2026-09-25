import mimetypes
import uuid
from datetime import date as date_type
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.crypto import InvalidToken, decrypt_bytes, encrypt_bytes
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.measurement import Measurement, ProgressPhoto
from app.models.user import User
from app.schemas.measurement import AddMeasurementRequest, MeasurementResponse, ProgressPhotoResponse

router = APIRouter(prefix="/measurements", tags=["measurements"])
settings = get_settings()

# Extension comes from the validated content type, never the client's filename,
# so a file is always served back as an image.
ALLOWED_PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
# Progress photos are body images: stored encrypted (app/core/crypto.py) and
# decrypted only when their owner requests them.
MAX_PHOTO_BYTES = 15 * 1024 * 1024


@router.get("", response_model=list[MeasurementResponse])
def list_measurements(
    type: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Measurement]:
    query = db.query(Measurement).filter(Measurement.user_id == current_user.id)
    if type:
        query = query.filter(Measurement.type == type)
    return query.order_by(Measurement.date).all()


@router.get("/types", response_model=list[str])
def list_measurement_types(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[str]:
    rows = (
        db.query(Measurement.type)
        .filter(Measurement.user_id == current_user.id)
        .distinct()
        .all()
    )
    return sorted(r[0] for r in rows)


@router.post("", response_model=MeasurementResponse, status_code=status.HTTP_201_CREATED)
def add_measurement(
    body: AddMeasurementRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Measurement:
    measurement = Measurement(user_id=current_user.id, **body.model_dump())
    db.add(measurement)
    db.commit()
    db.refresh(measurement)
    return measurement


@router.delete("/{measurement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_measurement(
    measurement_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    measurement = db.get(Measurement, measurement_id)
    if measurement is None or measurement.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Measurement not found")
    db.delete(measurement)
    db.commit()


@router.get("/photos", response_model=list[ProgressPhotoResponse])
def list_progress_photos(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ProgressPhoto]:
    return (
        db.query(ProgressPhoto)
        .filter(ProgressPhoto.user_id == current_user.id)
        .order_by(ProgressPhoto.date.desc())
        .all()
    )


@router.post("/photos", response_model=ProgressPhotoResponse, status_code=status.HTTP_201_CREATED)
def upload_progress_photo(
    date: date_type,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProgressPhoto:
    if file.content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image type")

    user_dir = Path(settings.storage_dir) / "progress_photos" / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)

    extension = ALLOWED_PHOTO_TYPES[file.content_type]
    filename = f"{uuid.uuid4()}{extension}"
    destination = user_dir / filename

    data = file.file.read(MAX_PHOTO_BYTES + 1)
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Photo is too large (max 15 MB)")
    destination.write_bytes(encrypt_bytes(data))

    storage_path = f"{current_user.id}/{filename}"
    photo = ProgressPhoto(user_id=current_user.id, storage_path=storage_path, date=date)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


@router.get("/photos/{photo_id}/file")
def get_progress_photo_file(
    photo_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    photo = db.get(ProgressPhoto, photo_id)
    if photo is None or photo.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")

    file_path = Path(settings.storage_dir) / "progress_photos" / photo.storage_path
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo file missing on disk")
    try:
        data = decrypt_bytes(file_path.read_bytes())
    except InvalidToken as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Photo can't be decrypted") from exc
    media_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    # Private, per-user content: never let a shared cache keep a copy.
    return Response(content=data, media_type=media_type, headers={"Cache-Control": "private, no-store"})


@router.delete("/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_progress_photo(
    photo_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    photo = db.get(ProgressPhoto, photo_id)
    if photo is None or photo.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")

    file_path = Path(settings.storage_dir) / "progress_photos" / photo.storage_path
    file_path.unlink(missing_ok=True)
    db.delete(photo)
    db.commit()
