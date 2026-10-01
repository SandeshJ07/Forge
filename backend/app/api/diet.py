import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user
from app.models.diet_plan import DietPlan
from app.models.profile import UserProfile
from app.models.user import User
from app.schemas.diet import DietAccess, DietGenerationStatus, DietPlanResponse, GenerateDietPlanRequest
from app.services.ai_errors import AIRequestError
from app.services.diet_generation import DietPlanParseError, NoOwnAIKey, generate_diet_plan, resolve_own_key

router = APIRouter(prefix="/diet-plans", tags=["diet"])
logger = logging.getLogger(__name__)

# A generation that hasn't finished in this long was lost (e.g. server restart mid-call).
STALE_AFTER = timedelta(minutes=12)


async def _run_generation(plan_id: UUID, user_id: UUID, preferences: dict) -> None:
    """Background task: the (slow) AI call with its own DB session, then marks the row ready/failed."""
    db = SessionLocal()
    try:
        try:
            plan_json, provider, model = await generate_diet_plan(db, user_id, preferences)
        except (NoOwnAIKey, DietPlanParseError, AIRequestError) as exc:
            _finish(db, plan_id, status="failed", error=str(exc))
            return
        except Exception:  # noqa: BLE001 — never leave a row stuck in 'generating'
            logger.exception("Diet plan generation crashed for plan %s", plan_id)
            _finish(db, plan_id, status="failed", error="Something went wrong while building your diet plan. Please try again.")
            return
        _finish(db, plan_id, status="ready", plan=plan_json, provider=provider, model=model)
    finally:
        db.close()


def _finish(db: Session, plan_id: UUID, **fields) -> None:
    db.rollback()
    plan = db.get(DietPlan, plan_id)
    if plan is None:  # user deleted meanwhile
        return
    for key, value in fields.items():
        setattr(plan, key, value)
    db.commit()


def _latest_job(db: Session, user_id: UUID) -> DietPlan | None:
    db.query(DietPlan).filter(
        DietPlan.user_id == user_id,
        DietPlan.status == "generating",
        DietPlan.created_at < datetime.now(timezone.utc) - STALE_AFTER,
    ).update(
        {DietPlan.status: "failed", DietPlan.error: "Diet plan generation was interrupted. Please try again."},
        synchronize_session=False,
    )
    db.commit()
    return db.query(DietPlan).filter(DietPlan.user_id == user_id).order_by(DietPlan.created_at.desc()).first()


@router.get("/access", response_model=DietAccess)
def get_access(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DietAccess:
    key = resolve_own_key(db, current_user.id)
    return DietAccess(available=key is not None, provider=key.provider if key else None)


@router.post("/generate", response_model=DietPlanResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate(
    body: GenerateDietPlanRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DietPlan:
    """
    Starts a diet plan generation on the user's own AI key and returns at once
    (202) with a 'generating' row; poll GET /diet-plans/generation. Only from
    an explicit user action. The server's shared key is never used here.
    """
    if resolve_own_key(db, current_user.id) is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Diet plans need your own Claude, Gemini or Groq API key. Add one in Settings.",
        )

    _latest_job(db, current_user.id)  # expires stale jobs (commits)
    # Lock the profile row so two simultaneous requests can't both pass the in-progress check.
    if db.query(UserProfile).filter(UserProfile.user_id == current_user.id).with_for_update().one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Finish setting up your profile first.")
    in_progress = (
        db.query(DietPlan.id).filter(DietPlan.user_id == current_user.id, DietPlan.status == "generating").first()
    )
    if in_progress is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A diet plan is already being generated.")

    preferences = body.preferences.model_dump(exclude_none=True)
    plan = DietPlan(user_id=current_user.id, status="generating", plan={}, preferences=preferences)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    background_tasks.add_task(_run_generation, plan.id, current_user.id, preferences)
    return plan


@router.get("/generation", response_model=DietGenerationStatus)
def get_generation_status(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> DietGenerationStatus:
    job = _latest_job(db, current_user.id)
    if job is None:
        return DietGenerationStatus(status="idle")
    return DietGenerationStatus(status=job.status, plan_id=job.id, error=job.error, started_at=job.created_at)


@router.get("/latest", response_model=DietPlanResponse | None)
def get_latest(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DietPlan | None:
    """The user's newest finished diet plan."""
    return (
        db.query(DietPlan)
        .filter(DietPlan.user_id == current_user.id, DietPlan.status == "ready")
        .order_by(DietPlan.created_at.desc())
        .first()
    )


@router.get("/last-preferences", response_model=dict)
def get_last_preferences(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """The choices from the user's most recent request (even a failed one), to pre-fill the form."""
    latest = db.query(DietPlan).filter(DietPlan.user_id == current_user.id).order_by(DietPlan.created_at.desc()).first()
    return latest.preferences if latest else {}
