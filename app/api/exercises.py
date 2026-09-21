from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import distinct, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.exercise import Exercise, UserExerciseFeedback
from app.models.user import User
from app.schemas.exercise import ExerciseFeedbackResponse, ExerciseResponse, SetExerciseFeedbackRequest

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseResponse])
def list_exercises(
    search: str | None = Query(default=None),
    muscle_group: str | None = Query(default=None),
    equipment: str | None = Query(default=None),
    difficulty: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[Exercise]:
    query = db.query(Exercise)
    if search:
        query = query.filter(Exercise.name.ilike(f"%{search}%"))
    if muscle_group:
        query = query.filter(Exercise.muscle_groups.any(muscle_group))
    if equipment:
        query = query.filter(Exercise.equipment == equipment)
    if difficulty:
        query = query.filter(Exercise.difficulty == difficulty)
    return query.order_by(Exercise.name).all()


@router.get("/muscle-groups", response_model=list[str])
def list_muscle_groups(db: Session = Depends(get_db)) -> list[str]:
    rows = db.execute(select(Exercise.muscle_groups)).scalars().all()
    groups: set[str] = set()
    for row in rows:
        groups.update(row or [])
    return sorted(groups)


@router.get("/equipment-options", response_model=list[str])
def list_equipment_options(db: Session = Depends(get_db)) -> list[str]:
    rows = db.execute(select(distinct(Exercise.equipment)).where(Exercise.equipment.is_not(None))).scalars().all()
    return sorted(rows)


@router.get("/{exercise_id}", response_model=ExerciseResponse)
def get_exercise(exercise_id: UUID, db: Session = Depends(get_db)) -> Exercise:
    return db.get(Exercise, exercise_id)


@router.get("/feedback/all", response_model=list[ExerciseFeedbackResponse])
def get_feedback_map(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[UserExerciseFeedback]:
    return db.query(UserExerciseFeedback).filter(UserExerciseFeedback.user_id == current_user.id).all()


@router.put("/{exercise_id}/feedback", response_model=ExerciseFeedbackResponse)
def set_feedback(
    exercise_id: UUID,
    body: SetExerciseFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserExerciseFeedback:
    feedback = db.get(UserExerciseFeedback, (current_user.id, exercise_id))
    if feedback is None:
        feedback = UserExerciseFeedback(user_id=current_user.id, exercise_id=exercise_id, rating=body.rating)
        db.add(feedback)
    else:
        feedback.rating = body.rating
    db.commit()
    db.refresh(feedback)
    return feedback
