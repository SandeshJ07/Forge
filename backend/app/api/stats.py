from collections import defaultdict
from datetime import datetime, timezone
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.exercise import Exercise
from app.models.personal_record import PersonalRecord
from app.models.user import User
from app.models.workout import Workout, WorkoutSet
from app.schemas.stats import Milestone, PeriodStats, StatsOverview, StrengthGain

router = APIRouter(prefix="/stats", tags=["stats"])

MILESTONES = [1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000]
MAX_GAINS = 3


def _month_bounds(now_local: datetime) -> tuple[datetime, datetime, datetime]:
    """(start of last month, start of this month, start of next month), in the user's timezone."""
    this_start = now_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_start = (this_start.replace(year=this_start.year - 1, month=12) if this_start.month == 1
                  else this_start.replace(month=this_start.month - 1))
    next_start = (this_start.replace(year=this_start.year + 1, month=1) if this_start.month == 12
                  else this_start.replace(month=this_start.month + 1))
    return last_start, this_start, next_start


def _next_milestone(total: int) -> Milestone | None:
    for index, target in enumerate(MILESTONES):
        if total < target:
            return Milestone(target=target, remaining=target - total, previous=MILESTONES[index - 1] if index else 0)
    return None


@router.get("/overview", response_model=StatsOverview)
def stats_overview(
    tz: str = Query(default="UTC", description="IANA timezone, e.g. Asia/Kolkata — months follow the user's calendar"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StatsOverview:
    try:
        zone = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        zone = ZoneInfo("UTC")
    last_start, this_start, next_start = _month_bounds(datetime.now(timezone.utc).astimezone(zone))

    def period_of(when: datetime) -> str | None:
        local = when.astimezone(zone)
        if this_start <= local < next_start:
            return "this"
        if last_start <= local < this_start:
            return "last"
        return None

    workouts = db.query(Workout.id, Workout.date).filter(Workout.user_id == current_user.id).all()
    workout_date = {w.id: w.date for w in workouts}
    periods = {"this": {"workouts": 0, "volume": 0.0, "records": 0}, "last": {"workouts": 0, "volume": 0.0, "records": 0}}
    for w in workouts:
        if (p := period_of(w.date)) is not None:
            periods[p]["workouts"] += 1

    rows = (
        db.query(WorkoutSet.workout_id, WorkoutSet.exercise_id, WorkoutSet.weight_kg, WorkoutSet.reps)
        .join(Workout, Workout.id == WorkoutSet.workout_id)
        .filter(Workout.user_id == current_user.id)
        .all()
    )

    total_reps = 0
    total_volume = 0.0
    # Per exercise: best weight in each workout, to compare the first session with the best ever.
    best_by_exercise_workout: dict[UUID, dict[UUID, float]] = defaultdict(dict)
    for row in rows:
        weight = float(row.weight_kg) if row.weight_kg is not None else None
        total_reps += row.reps or 0
        if weight and row.reps:
            volume = weight * row.reps
            total_volume += volume
            if (p := period_of(workout_date[row.workout_id])) is not None:
                periods[p]["volume"] += volume
        if weight and row.exercise_id:
            per_workout = best_by_exercise_workout[row.exercise_id]
            per_workout[row.workout_id] = max(per_workout.get(row.workout_id, 0.0), weight)

    gains: list[tuple[UUID, float, float]] = []
    for exercise_id, per_workout in best_by_exercise_workout.items():
        if len(per_workout) < 2:
            continue  # one session isn't a trend
        first_workout = min(per_workout, key=lambda wid: workout_date[wid])
        first_best, current_best = per_workout[first_workout], max(per_workout.values())
        if current_best > first_best:
            gains.append((exercise_id, first_best, current_best))
    gains.sort(key=lambda g: (g[2] - g[1]) / g[1], reverse=True)
    gains = gains[:MAX_GAINS]
    names = dict(db.query(Exercise.id, Exercise.name).filter(Exercise.id.in_([g[0] for g in gains])).all()) if gains else {}

    for record in db.query(PersonalRecord.achieved_at).filter(PersonalRecord.user_id == current_user.id):
        if (p := period_of(record.achieved_at)) is not None:
            periods[p]["records"] += 1

    def period_stats(key: str) -> PeriodStats:
        data = periods[key]
        return PeriodStats(workouts=data["workouts"], volume_kg=round(data["volume"], 1), records=data["records"])

    return StatsOverview(
        first_workout_at=min((w.date for w in workouts), default=None),
        total_workouts=len(workouts),
        total_sets=len(rows),
        total_reps=total_reps,
        total_volume_kg=round(total_volume, 1),
        this_month=period_stats("this"),
        last_month=period_stats("last"),
        strength_gains=[
            StrengthGain(
                exercise_id=exercise_id,
                exercise_name=names.get(exercise_id, "Exercise"),
                first_best_kg=first,
                current_best_kg=best,
                gain_kg=round(best - first, 1),
                gain_pct=round((best - first) / first * 100, 1),
            )
            for exercise_id, first, best in gains
        ],
        next_milestone=_next_milestone(len(workouts)),
    )
