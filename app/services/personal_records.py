from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.personal_record import PersonalRecord


class SetCandidate:
    __slots__ = ("exercise_id", "weight_kg", "reps", "workout_id", "date")

    def __init__(self, exercise_id: UUID, weight_kg: float, reps: int | None, workout_id: UUID, date: datetime):
        self.exercise_id = exercise_id
        self.weight_kg = weight_kg
        self.reps = reps
        self.workout_id = workout_id
        self.date = date


def update_personal_records(db: Session, user_id: UUID, candidates: list[SetCandidate]) -> list[UUID]:
    """
    Compares each candidate set's weight against the current best for that
    exercise and upserts a new record wherever it improves. Returns the
    exercise ids that got a new PR, so the caller can surface a "new PR!"
    moment from whatever action produced it (matches the previous
    client-side src/api/personalRecords.ts logic, moved server-side).
    """
    with_weight = [c for c in candidates if c.weight_kg and c.weight_kg > 0]
    if not with_weight:
        return []

    exercise_ids = {c.exercise_id for c in with_weight}
    existing = (
        db.query(PersonalRecord)
        .filter(PersonalRecord.user_id == user_id, PersonalRecord.exercise_id.in_(exercise_ids))
        .all()
    )
    best_by_exercise: dict[UUID, float] = {r.exercise_id: float(r.best_weight_kg) for r in existing}

    new_best_by_exercise: dict[UUID, SetCandidate] = {}
    for candidate in with_weight:
        current_best = max(
            best_by_exercise.get(candidate.exercise_id, 0),
            new_best_by_exercise.get(candidate.exercise_id).weight_kg
            if candidate.exercise_id in new_best_by_exercise
            else 0,
        )
        if candidate.weight_kg > current_best:
            new_best_by_exercise[candidate.exercise_id] = candidate

    if not new_best_by_exercise:
        return []

    existing_by_exercise = {r.exercise_id: r for r in existing}
    for exercise_id, candidate in new_best_by_exercise.items():
        record = existing_by_exercise.get(exercise_id)
        if record is None:
            record = PersonalRecord(user_id=user_id, exercise_id=exercise_id)
            db.add(record)
        record.best_weight_kg = candidate.weight_kg
        record.best_weight_reps = candidate.reps
        record.achieved_at = candidate.date
        record.workout_id = candidate.workout_id

    db.commit()
    return list(new_best_by_exercise.keys())
