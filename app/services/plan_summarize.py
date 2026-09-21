from collections import Counter
from datetime import datetime, timedelta, timezone

from app.services.plan_prompt import WorkoutHistorySummary


def summarize_workout_history(workouts: list, sets: list) -> WorkoutHistorySummary:
    """Aggregates raw workout/set rows into the small summary shape the prompt uses."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=28)
    recent = [w for w in workouts if w.date >= cutoff]

    exercise_counts: Counter[str] = Counter()
    for s in sets:
        if s.exercise_name_raw:
            exercise_counts[s.exercise_name_raw] += 1

    most_frequent = [{"name": name, "count": count} for name, count in exercise_counts.most_common(15)]

    recent_feedback = [
        {"felt_rating": w.felt_rating, "enjoyed": w.enjoyed}
        for w in recent
        if w.felt_rating or w.enjoyed is not None
    ][:10]

    return WorkoutHistorySummary(
        total_workouts_last_28_days=len(recent),
        avg_workouts_per_week=len(recent) / 4,
        most_frequent_exercises=most_frequent,
        recent_feedback=recent_feedback,
    )
