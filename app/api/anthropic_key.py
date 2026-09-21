from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.integration_token import IntegrationToken
from app.models.profile import UserProfile
from app.models.user import User
from app.schemas.anthropic_key import AnthropicKeyStatusResponse, SaveAnthropicKeyRequest
from app.services.anthropic_client import AnthropicKeyInvalid, validate_key

router = APIRouter(prefix="/anthropic-key", tags=["anthropic-key"])
settings = get_settings()


@router.put("", response_model=AnthropicKeyStatusResponse)
async def save_key(
    body: SaveAnthropicKeyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnthropicKeyStatusResponse:
    try:
        await validate_key(body.api_key, settings.anthropic_model)
    except AnthropicKeyInvalid as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    token = db.get(IntegrationToken, (current_user.id, "anthropic"))
    if token is None:
        token = IntegrationToken(user_id=current_user.id, provider="anthropic", access_token=body.api_key)
        db.add(token)
    else:
        token.access_token = body.api_key

    profile = db.get(UserProfile, current_user.id)
    if profile is None:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
    profile.anthropic_api_key_set = True

    db.commit()
    return AnthropicKeyStatusResponse(connected=True)


@router.delete("", response_model=AnthropicKeyStatusResponse)
def clear_key(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AnthropicKeyStatusResponse:
    token = db.get(IntegrationToken, (current_user.id, "anthropic"))
    if token is not None:
        db.delete(token)

    profile = db.get(UserProfile, current_user.id)
    if profile is None:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
    profile.anthropic_api_key_set = False

    db.commit()
    return AnthropicKeyStatusResponse(connected=False)
