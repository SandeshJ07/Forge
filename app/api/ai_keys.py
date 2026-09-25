from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.integration_token import IntegrationToken
from app.models.profile import UserProfile
from app.models.user import User
from app.schemas.ai_key import AIKeyStatusResponse, SaveAIKeyRequest
from app.services.ai_errors import AIKeyInvalid
from app.services.ai_providers import AIProvider, validate_key

router = APIRouter(prefix="/ai-keys", tags=["ai-keys"])


def _profile(db: Session, user_id) -> UserProfile:
    profile = db.get(UserProfile, user_id)
    if profile is None:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
    return profile


def _set_flag(profile: UserProfile, provider: AIProvider, value: bool) -> None:
    if provider == "anthropic":
        profile.anthropic_api_key_set = value
    else:
        profile.gemini_api_key_set = value


@router.put("/{provider}", response_model=AIKeyStatusResponse)
async def save_key(
    provider: AIProvider,
    body: SaveAIKeyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AIKeyStatusResponse:
    try:
        await validate_key(provider, body.api_key)
    except AIKeyInvalid as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    token = db.get(IntegrationToken, (current_user.id, provider))
    if token is None:
        db.add(IntegrationToken(user_id=current_user.id, provider=provider, access_token=body.api_key))
    else:
        token.access_token = body.api_key

    _set_flag(_profile(db, current_user.id), provider, True)
    db.commit()
    return AIKeyStatusResponse(provider=provider, connected=True)


@router.delete("/{provider}", response_model=AIKeyStatusResponse)
def clear_key(
    provider: AIProvider, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> AIKeyStatusResponse:
    token = db.get(IntegrationToken, (current_user.id, provider))
    if token is not None:
        db.delete(token)
    _set_flag(_profile(db, current_user.id), provider, False)
    db.commit()
    return AIKeyStatusResponse(provider=provider, connected=False)
