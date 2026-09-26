from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.exercise import Exercise
from app.models.user import User
from app.models.workout import Workout, WorkoutSet
from app.schemas.workout import (
    LogManualWorkoutRequest,
    LogManualWorkoutResponse,
    RateWorkoutRequest,
    WorkoutResponse,
    WorkoutSetResponse,
)
from app.services.personal_records import SetCandidate, update_personal_records

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.get("", response_model=list[WorkoutResponse])
def list_workouts(
    limit: int = Query(default=50, ge=1, le=1000),
    start: datetime | None = Query(default=None, description="Only workouts at or after this time (ISO 8601)"),
    end: datetime | None = Query(default=None, description="Only workouts before this time (ISO 8601)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Workout]:
    """Newest first. start/end (e.g. a local calendar month's bounds) narrow it to a range."""
    query = db.query(Workout).filter(Workout.user_id == current_user.id)
    if start is not None:
        query = query.filter(Workout.date >= start)
    if end is not None:
        query = query.filter(Workout.date < end)
    return query.order_by(Workout.date.desc()).limit(limit).all()


@router.get("/{workout_id}/sets", response_model=list[WorkoutSetResponse])
def get_workout_sets(
    workout_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[WorkoutSet]:
    workout = db.get(Workout, workout_id)
    if workout is None or workout.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout not found")
    return (
        db.query(WorkoutSet)
        .filter(WorkoutSet.workout_id == workout_id)
        .order_by(WorkoutSet.set_index)
        .all()
    )


@router.post("", response_model=LogManualWorkoutResponse, status_code=status.HTTP_201_CREATED)
def log_manual_workout(
    body: LogManualWorkoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LogManualWorkoutResponse:
    exercise_ids = {s.exercise_id for s in body.sets if s.exercise_id is not None}
    known_ids = {row[0] for row in db.query(Exercise.id).filter(Exercise.id.in_(exercise_ids)).all()}
    if known_ids != exercise_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown exercise in workout")

    workout = Workout(
        user_id=current_user.id,
        source="manual",
        title=body.title,
        date=body.date,
        duration_seconds=body.duration_seconds,
        summary=f"{len(body.sets)} sets logged manually",
    )
    db.add(workout)
    db.flush()  # assigns workout.id without committing yet

    for index, set_input in enumerate(body.sets):
        db.add(
            WorkoutSet(
                workout_id=workout.id,
                exercise_id=set_input.exercise_id,
                exercise_name_raw=set_input.exercise_name,
                set_index=index,
                weight_kg=set_input.weight_kg,
                reps=set_input.reps,
                duration_seconds=set_input.duration_seconds,
                distance_meters=set_input.distance_meters,
                rpe=set_input.rpe,
                started_at=set_input.started_at,
                ended_at=set_input.ended_at,
            )
        )
    db.commit()
    db.refresh(workout)

    candidates = [
        SetCandidate(
            exercise_id=s.exercise_id,
            weight_kg=s.weight_kg,
            reps=s.reps,
            workout_id=workout.id,
            date=body.date,
        )
        for s in body.sets
        if s.weight_kg and s.exercise_id
    ]
    new_pr_exercise_ids = update_personal_records(db, current_user.id, candidates) if candidates else []

    return LogManualWorkoutResponse(workout_id=workout.id, new_personal_record_exercise_ids=new_pr_exercise_ids)


@router.patch("/{workout_id}", response_model=WorkoutResponse)
def rate_workout(
    workout_id: UUID,
    body: RateWorkoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Workout:
    workout = db.get(Workout, workout_id)
    if workout is None or workout.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(workout, field, value)
    db.commit()
    db.refresh(workout)
    return workout
