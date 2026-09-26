import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user
from app.models.plan import GeneratedPlan
from app.models.profile import UserProfile
from app.models.user import User
from app.schemas.plan import (
    GeneratePlanRequest,
    GeneratedPlanResponse,
    PlanGenerationStatus,
    PlanUsage,
    UpdatePlanContentRequest,
)
from app.services.ai_errors import AIRequestError
from app.services.ai_providers import PROVIDER_NAMES
from app.services.plan_generation import (
    NoAIKeyAvailable,
    PlanParseError,
    finalize_plan_json,
    generate_plan_for_user,
    local_day_start,
    next_local_midnight,
    resolve_ai_access,
    shared_key_generations_since,
)

router = APIRouter(prefix="/plans", tags=["plans"])
settings = get_settings()

TZ_QUERY = Query(default="UTC", description="IANA timezone, e.g. Asia/Kolkata — the daily limit resets at local midnight")
logger = logging.getLogger(__name__)


# A generation that hasn't finished in this long was lost (e.g. server restart
# mid-call) — the AI call itself times out well before this.
STALE_AFTER = timedelta(minutes=12)


async def _run_generation(plan_id: UUID, user_id: UUID, preferences: dict) -> None:
    """Background task: does the (slow) AI call with its own DB session, then marks the row ready/failed."""
    db = SessionLocal()
    try:
        try:
            plan_json, source_summary = await generate_plan_for_user(db, user_id, preferences)
        except (NoAIKeyAvailable, PlanParseError, AIRequestError) as exc:
            _finish(db, plan_id, status="failed", error=str(exc))
            return
        except Exception:  # noqa: BLE001 — never leave a row stuck in 'generating'
            logger.exception("Plan generation crashed for plan %s", plan_id)
            _finish(db, plan_id, status="failed", error="Something went wrong while building your plan. Please try again.")
            return
        _finish(db, plan_id, status="ready", plan=plan_json, source_summary=source_summary)
    finally:
        db.close()


def _finish(db: Session, plan_id: UUID, **fields) -> None:
    db.rollback()  # discard anything half-done by the failed attempt
    plan = db.get(GeneratedPlan, plan_id)
    if plan is None:  # user deleted meanwhile
        return
    for key, value in fields.items():
        setattr(plan, key, value)
    db.commit()


def _latest_job(db: Session, user_id: UUID) -> GeneratedPlan | None:
    # Expire any of this user's jobs lost mid-generation (e.g. server restart), not just the newest.
    db.query(GeneratedPlan).filter(
        GeneratedPlan.user_id == user_id,
        GeneratedPlan.status == "generating",
        GeneratedPlan.created_at < datetime.now(timezone.utc) - STALE_AFTER,
    ).update(
        {GeneratedPlan.status: "failed", GeneratedPlan.error: "Plan generation was interrupted. Please try again."},
        synchronize_session=False,
    )
    db.commit()
    return (
        db.query(GeneratedPlan)
        .filter(GeneratedPlan.user_id == user_id)
        .order_by(GeneratedPlan.created_at.desc())
        .first()
    )


def _ready_plans(db: Session, user_id: UUID):
    return (
        db.query(GeneratedPlan)
        .filter(GeneratedPlan.user_id == user_id, GeneratedPlan.status == "ready")
        .order_by(GeneratedPlan.created_at.desc())
    )


@router.post("/generate", response_model=GeneratedPlanResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_plan(
    background_tasks: BackgroundTasks,
    body: GeneratePlanRequest | None = None,
    tz: str = TZ_QUERY,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GeneratedPlan:
    """
    Starts plan generation and returns immediately (202) with a 'generating'
    placeholder row; the AI call runs as a background task so the user can
    keep using the app. Poll GET /plans/generation for progress.

    The only endpoint that calls an AI provider (Anthropic or Gemini, per the
    user's ai_provider), and only ever from an explicit user action — never on
    a schedule.
    """
    preferences = (body or GeneratePlanRequest()).preferences.model_dump(exclude_none=True)

    # Save the choices first, so they're kept (and pre-filled next time) even if
    # this request is then rejected or the generation fails.
    profile = db.get(UserProfile, current_user.id)
    if profile is None:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
    profile.plan_preferences = preferences
    db.commit()

    _latest_job(db, current_user.id)  # expires stale jobs (commits)

    # Lock the profile row so two simultaneous requests can't both pass the
    # in-progress and daily-limit checks below; held until the commit that
    # inserts the new job.
    db.query(UserProfile).filter(UserProfile.user_id == current_user.id).with_for_update().one()

    in_progress = (
        db.query(GeneratedPlan.id)
        .filter(GeneratedPlan.user_id == current_user.id, GeneratedPlan.status == "generating")
        .first()
    )
    if in_progress is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A plan is already being generated.")

    # Fail fast on a missing key instead of queueing a job that can only fail.
    access = resolve_ai_access(db, current_user.id)
    if not access.api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No {PROVIDER_NAMES[access.provider]} API key available. Add your own key in Settings, "
            "switch AI provider, or configure a shared key on the server.",
        )

    if not access.own_key:
        limit = settings.shared_key_daily_plan_limit
        if shared_key_generations_since(db, current_user.id, local_day_start(tz)) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"You've used all {limit} plan generations for today. They reset at midnight — "
                "or add your own API key in Settings for unlimited generations.",
            )

    plan = GeneratedPlan(
        user_id=current_user.id,
        plan={},
        source_summary={"preferences": preferences},
        accepted=False,
        status="generating",
        used_shared_key=not access.own_key,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    background_tasks.add_task(_run_generation, plan.id, current_user.id, preferences)
    return plan


@router.get("/usage", response_model=PlanUsage)
def get_usage(
    tz: str = TZ_QUERY, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PlanUsage:
    access = resolve_ai_access(db, current_user.id)
    day_start = local_day_start(tz)
    used = shared_key_generations_since(db, current_user.id, day_start)
    limit = None if access.own_key else settings.shared_key_daily_plan_limit
    return PlanUsage(
        own_key=access.own_key,
        provider=access.provider,
        limit=limit,
        used=used,
        remaining=None if limit is None else max(0, limit - used),
        resets_at=next_local_midnight(day_start),
    )


@router.get("/generation", response_model=PlanGenerationStatus)
def get_generation_status(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PlanGenerationStatus:
    job = _latest_job(db, current_user.id)
    if job is None:
        return PlanGenerationStatus(status="idle")
    return PlanGenerationStatus(status=job.status, plan_id=job.id, error=job.error, started_at=job.created_at)


@router.get("", response_model=list[GeneratedPlanResponse])
def list_plans(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[GeneratedPlan]:
    return _ready_plans(db, current_user.id).all()


def _current_plan(db: Session, user_id: UUID) -> GeneratedPlan | None:
    return (
        db.query(GeneratedPlan)
        .filter(GeneratedPlan.user_id == user_id, GeneratedPlan.status == "ready", GeneratedPlan.accepted.is_(True))
        .order_by(GeneratedPlan.accepted_at.desc().nulls_last())
        .first()
    )


def _owned_ready_plan(db: Session, plan_id: UUID, user_id: UUID) -> GeneratedPlan:
    plan = db.get(GeneratedPlan, plan_id)
    if plan is None or plan.user_id != user_id or plan.status != "ready":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return plan


@router.get("/latest", response_model=GeneratedPlanResponse | None)
def get_latest_plan(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> GeneratedPlan | None:
    """The user's current plan: the one they accepted most recently (not simply the newest generated)."""
    return _current_plan(db, current_user.id)


@router.get("/pending", response_model=GeneratedPlanResponse | None)
def get_pending_plan(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> GeneratedPlan | None:
    """A newly generated plan waiting for the user to accept, edit or dismiss it. It never replaces the current plan by itself."""
    current = _current_plan(db, current_user.id)
    query = _ready_plans(db, current_user.id).filter(
        GeneratedPlan.accepted.is_(False), GeneratedPlan.dismissed.is_(False)
    )
    if current is not None and current.accepted_at is not None:
        query = query.filter(GeneratedPlan.created_at > current.accepted_at)
    return query.first()


@router.post("/{plan_id}/accept", response_model=GeneratedPlanResponse)
def accept_plan(
    plan_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> GeneratedPlan:
    """Makes this plan the current one — a freshly generated plan, or an older one loaded back from history."""
    plan = _owned_ready_plan(db, plan_id, current_user.id)
    db.query(GeneratedPlan).filter(
        GeneratedPlan.user_id == current_user.id, GeneratedPlan.id != plan.id, GeneratedPlan.accepted.is_(True)
    ).update({GeneratedPlan.accepted: False}, synchronize_session=False)
    plan.accepted = True
    plan.accepted_at = datetime.now(timezone.utc)
    plan.dismissed = False
    db.commit()
    db.refresh(plan)
    return plan


@router.post("/{plan_id}/dismiss", response_model=GeneratedPlanResponse)
def dismiss_plan(
    plan_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> GeneratedPlan:
    """Keeps the current plan; the dismissed one stays in history and can be loaded later."""
    plan = _owned_ready_plan(db, plan_id, current_user.id)
    if plan.accepted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The current plan can't be dismissed")
    plan.dismissed = True
    db.commit()
    db.refresh(plan)
    return plan


@router.put("/{plan_id}/content", response_model=GeneratedPlanResponse)
def update_plan_content(
    plan_id: UUID,
    body: UpdatePlanContentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GeneratedPlan:
    """Saves the user's own edits to a plan (e.g. while reviewing a new one before accepting it)."""
    plan = _owned_ready_plan(db, plan_id, current_user.id)
    try:
        plan.plan = finalize_plan_json(db, dict(body.plan))
    except PlanParseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from None
    db.commit()
    db.refresh(plan)
    return plan
