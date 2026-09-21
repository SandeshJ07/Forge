from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.profile import UserProfile
from app.models.user import User
from app.schemas.profile import UserProfileResponse, UserProfileUpdate

router = APIRouter(prefix="/profile", tags=["profile"])


def _get_or_create_profile(db: Session, user_id) -> UserProfile:
    profile = db.get(UserProfile, user_id)
    if profile is None:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.get("", response_model=UserProfileResponse)
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserProfile:
    return _get_or_create_profile(db, current_user.id)


@router.patch("", response_model=UserProfileResponse)
def update_profile(
    body: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserProfile:
    profile = _get_or_create_profile(db, current_user.id)
    for field, value in body.dump_set_fields().items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/complete-onboarding", response_model=UserProfileResponse)
def complete_onboarding(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> UserProfile:
    profile = _get_or_create_profile(db, current_user.id)
    profile.onboarded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(profile)
    return profile
