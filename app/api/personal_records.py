from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.exercise import Exercise
from app.models.personal_record import PersonalRecord
from app.models.user import User
from app.schemas.personal_record import PersonalRecordResponse

router = APIRouter(prefix="/personal-records", tags=["personal-records"])


@router.get("", response_model=list[PersonalRecordResponse])
def list_personal_records(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[PersonalRecordResponse]:
    rows = db.execute(
        select(PersonalRecord, Exercise.name)
        .join(Exercise, Exercise.id == PersonalRecord.exercise_id)
        .where(PersonalRecord.user_id == current_user.id)
        .order_by(PersonalRecord.achieved_at.desc())
    ).all()

    return [
        PersonalRecordResponse(
            user_id=record.user_id,
            exercise_id=record.exercise_id,
            exercise_name=exercise_name,
            best_weight_kg=record.best_weight_kg,
            best_weight_reps=record.best_weight_reps,
            achieved_at=record.achieved_at,
            workout_id=record.workout_id,
            updated_at=record.updated_at,
        )
        for record, exercise_name in rows
    ]
