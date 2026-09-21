from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.plan import GeneratedPlan
from app.models.user import User
from app.schemas.plan import GeneratedPlanResponse, SetPlanAcceptedRequest
from app.services.anthropic_client import AnthropicRequestError
from app.services.plan_generation import NoAnthropicKeyAvailable, PlanParseError, generate_plan_for_user

router = APIRouter(prefix="/plans", tags=["plans"])


@router.post("/generate", response_model=GeneratedPlanResponse, status_code=status.HTTP_201_CREATED)
async def generate_plan(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> GeneratedPlan:
    """
    The only endpoint that calls the Anthropic API. Only ever triggered by
    an explicit "Generate"/"Regenerate" tap in the app — never on a schedule.
    """
    try:
        plan_json, source_summary = await generate_plan_for_user(db, current_user.id)
    except NoAnthropicKeyAvailable as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except (PlanParseError, AnthropicRequestError) as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    plan = GeneratedPlan(user_id=current_user.id, plan=plan_json, source_summary=source_summary, accepted=False)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("", response_model=list[GeneratedPlanResponse])
def list_plans(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[GeneratedPlan]:
    return (
        db.query(GeneratedPlan)
        .filter(GeneratedPlan.user_id == current_user.id)
        .order_by(GeneratedPlan.created_at.desc())
        .all()
    )


@router.get("/latest", response_model=GeneratedPlanResponse | None)
def get_latest_plan(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> GeneratedPlan | None:
    return (
        db.query(GeneratedPlan)
        .filter(GeneratedPlan.user_id == current_user.id)
        .order_by(GeneratedPlan.created_at.desc())
        .first()
    )


@router.patch("/{plan_id}", response_model=GeneratedPlanResponse)
def set_plan_accepted(
    plan_id: UUID,
    body: SetPlanAcceptedRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GeneratedPlan:
    plan = db.get(GeneratedPlan, plan_id)
    if plan is None or plan.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    plan.accepted = body.accepted
    db.commit()
    db.refresh(plan)
    return plan
