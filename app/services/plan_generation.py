import json
import re
from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.exercise import Exercise, UserExerciseFeedback
from app.models.measurement import Measurement
from app.models.integration_token import IntegrationToken
from app.models.personal_record import PersonalRecord
from app.models.profile import UserProfile
from app.models.workout import Workout, WorkoutSet
from app.services.anthropic_client import create_message
from app.services.plan_prompt import PersonalRecordSummary, PlanGenerationInput, build_plan_prompt
from app.services.plan_summarize import summarize_workout_history

settings = get_settings()


class NoAnthropicKeyAvailable(Exception):
    pass


class PlanParseError(Exception):
    pass


def resolve_anthropic_api_key(db: Session, user_id: UUID) -> str | None:
    token = db.get(IntegrationToken, (user_id, "anthropic"))
    if token is not None:
        return token.access_token
    return settings.anthropic_api_key


def _build_prompt_input(db: Session, user_id: UUID) -> PlanGenerationInput:
    profile = db.get(UserProfile, user_id)

    workouts = db.query(Workout).filter(Workout.user_id == user_id).order_by(Workout.date.desc()).limit(60).all()
    workout_ids = [w.id for w in workouts]
    sets = (
        db.query(WorkoutSet).filter(WorkoutSet.workout_id.in_(workout_ids)).all()
        if workout_ids
        else []
    )
    recent_workout_summary = summarize_workout_history(workouts, sets)

    feedback_rows = (
        db.query(UserExerciseFeedback, Exercise.name)
        .join(Exercise, Exercise.id == UserExerciseFeedback.exercise_id)
        .filter(UserExerciseFeedback.user_id == user_id)
        .all()
    )
    liked = [name for feedback, name in feedback_rows if feedback.rating == "like"]
    disliked = [name for feedback, name in feedback_rows if feedback.rating == "dislike"]

    exercises = db.query(Exercise.name).limit(300).all()
    available_exercise_names = [row[0] for row in exercises]

    record_rows = (
        db.query(PersonalRecord, Exercise.name)
        .join(Exercise, Exercise.id == PersonalRecord.exercise_id)
        .filter(PersonalRecord.user_id == user_id)
        .all()
    )
    personal_records = [
        PersonalRecordSummary(name=name, best_weight_kg=float(record.best_weight_kg), best_weight_reps=record.best_weight_reps)
        for record, name in record_rows
    ]

    latest_weight_row = (
        db.query(Measurement)
        .filter(Measurement.user_id == user_id, Measurement.type == "body_weight")
        .order_by(Measurement.date.desc())
        .first()
    )
    latest_body_weight_kg = None
    if latest_weight_row is not None:
        value = float(latest_weight_row.value)
        latest_body_weight_kg = round(value * 0.453592, 1) if latest_weight_row.unit == "lb" else round(value, 1)

    age = None
    if profile and profile.birth_year:
        age = datetime.now(timezone.utc).year - profile.birth_year

    return PlanGenerationInput(
        goal=profile.goal if profile else None,
        experience_level=profile.experience_level if profile else None,
        equipment_access=profile.equipment_access if profile else None,
        unit_system=profile.unit_system if profile else "metric",
        include_warmup=profile.include_warmup if profile else True,
        gender=profile.gender if profile else None,
        age=age,
        height_cm=float(profile.height_cm) if profile and profile.height_cm else None,
        latest_body_weight_kg=latest_body_weight_kg,
        recent_workout_summary=recent_workout_summary,
        liked_exercises=liked,
        disliked_exercises=disliked,
        available_exercise_names=available_exercise_names,
        personal_records=personal_records,
    )


def _parse_plan_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            return json.loads(match.group(0))
        raise PlanParseError("Failed to parse plan JSON from Claude response") from None


async def generate_plan_for_user(db: Session, user_id: UUID) -> tuple[dict, dict]:
    """Returns (plan_json, source_summary_json) — the caller persists these to generated_plans."""
    api_key = resolve_anthropic_api_key(db, user_id)
    if not api_key:
        raise NoAnthropicKeyAvailable(
            "No Anthropic API key available. Add your own key in Settings, or configure a shared key on the server."
        )

    prompt_input = _build_prompt_input(db, user_id)
    prompt = build_plan_prompt(prompt_input)

    text = await create_message(api_key, settings.anthropic_model, prompt, max_tokens=2500)
    plan_json = _parse_plan_json(text)

    source_summary = {
        "total_workouts_last_28_days": prompt_input.recent_workout_summary.total_workouts_last_28_days,
        "avg_workouts_per_week": prompt_input.recent_workout_summary.avg_workouts_per_week,
        "most_frequent_exercises": prompt_input.recent_workout_summary.most_frequent_exercises,
        "recent_feedback": prompt_input.recent_workout_summary.recent_feedback,
    }
    return plan_json, source_summary
