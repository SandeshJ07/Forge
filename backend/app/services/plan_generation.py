import json
import random
import re
from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.exercise import Exercise, UserExerciseFeedback
from app.models.measurement import Measurement
from app.models.integration_token import IntegrationToken
from app.models.personal_record import PersonalRecord
from app.models.profile import UserProfile
from app.models.workout import Workout, WorkoutSet
from app.services.equipment_catalog import display_names, glossary_equipment
from app.services.ai_providers import PROVIDER_NAMES, AIProvider, generate_text, shared_key_for
from app.services.plan_prompt import PersonalRecordSummary, PlanGenerationInput, build_plan_prompt
from app.services.plan_summarize import summarize_workout_history

settings = get_settings()


# How many glossary exercise names go into the prompt. Every name costs
# tokens on every generation, so this is filtered to what the athlete can
# actually do rather than the full ~876-row glossary.
PROMPT_EXERCISE_LIMIT = 250

PROMPT_EXERCISE_CATEGORIES = ("strength", "powerlifting", "plyometrics", "olympic weightlifting", "cardio")

# Onboarding's equipment choices -> free-exercise-db `equipment` values.
EQUIPMENT_ACCESS_TO_GLOSSARY = {
    "barbell": ("barbell", "e-z curl bar"),
    "dumbbell": ("dumbbell",),
    "machine": ("machine", "cable"),
    "bodyweight": ("body only",),
    "kettlebell": ("kettlebells",),
    "bands": ("bands",),
}
# No equipment answer means "assume a standard commercial gym".
DEFAULT_GLOSSARY_EQUIPMENT = (
    "barbell", "e-z curl bar", "dumbbell", "machine", "cable", "body only", "kettlebells", "bands", "medicine ball",
)


class NoAIKeyAvailable(Exception):
    pass


class PlanParseError(Exception):
    pass


def resolve_provider_and_key(db: Session, user_id: UUID) -> tuple[AIProvider, str | None]:
    """The user's chosen provider, with their own key for it if they've added one, else the server's shared key."""
    profile = db.get(UserProfile, user_id)
    provider: AIProvider = profile.ai_provider if profile and profile.ai_provider in ("anthropic", "gemini") else "anthropic"
    token = db.get(IntegrationToken, (user_id, provider))
    return provider, (token.access_token if token is not None else shared_key_for(provider))


def _build_prompt_input(db: Session, user_id: UUID, plan_equipment: list[str] | None = None) -> PlanGenerationInput:
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

    available_exercise_names = _select_prompt_exercise_names(
        db,
        equipment_access=profile.equipment_access if profile else None,
        experience_level=profile.experience_level if profile else None,
        glossary_override=glossary_equipment(plan_equipment) if plan_equipment is not None else None,
        prioritized_names=liked + [e["name"] for e in recent_workout_summary.most_frequent_exercises],
        excluded_names=disliked,
    )

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


def _select_prompt_exercise_names(
    db: Session,
    equipment_access: list[str] | None,
    experience_level: str | None,
    prioritized_names: list[str],
    excluded_names: list[str],
    glossary_override: set[str] | None = None,
) -> list[str]:
    """
    Picks which glossary names the prompt offers: only training categories,
    only equipment the athlete has, no advanced movements for beginners.
    Names the athlete likes or already trains go first; the rest are
    shuffled so a cut at PROMPT_EXERCISE_LIMIT isn't biased toward A-names.
    """
    equipment: set[str] = {"body only"}
    for choice in equipment_access or []:
        equipment.update(EQUIPMENT_ACCESS_TO_GLOSSARY.get(choice.lower(), ()))
    if not equipment_access:
        equipment.update(DEFAULT_GLOSSARY_EQUIPMENT)
    if glossary_override is not None:
        # Per-plan picks from the Plan preferences screen win over the profile's broad categories.
        equipment = glossary_override

    query = db.query(Exercise.name).filter(
        Exercise.category.in_(PROMPT_EXERCISE_CATEGORIES),
        Exercise.equipment.in_(equipment),
    )
    if experience_level == "beginner":
        query = query.filter(Exercise.difficulty.is_distinct_from("advanced"))
    candidates = sorted({row[0] for row in query.all()})

    excluded = {name.lower() for name in excluded_names}
    candidates = [name for name in candidates if name.lower() not in excluded]

    prioritized = {name.lower() for name in prioritized_names}
    first = [name for name in candidates if name.lower() in prioritized]
    rest = [name for name in candidates if name.lower() not in prioritized]
    random.shuffle(rest)
    return (first + rest)[:PROMPT_EXERCISE_LIMIT]


def _attach_exercise_ids(db: Session, plan_json: dict) -> None:
    """
    Fills each plan exercise's exercise_id by exact (case-insensitive) name
    match against the glossary, so the app can link to the exercise detail
    page. Claude only ever sees names — asking it for ids would mean either
    pasting hundreds of UUIDs into the prompt or getting invented ones back.
    Exercises with no glossary match keep exercise_id = None.
    """
    plan_exercises = [
        exercise
        for group in plan_json.get("groups") or []
        for exercise in group.get("exercises") or []
        if isinstance(exercise, dict)
    ]
    names = {str(e.get("exercise_name", "")).strip().lower() for e in plan_exercises} - {""}
    if not names:
        return

    rows = db.query(Exercise.id, Exercise.name).filter(func.lower(Exercise.name).in_(names)).all()
    id_by_name = {name.lower(): str(exercise_id) for exercise_id, name in rows}
    for exercise in plan_exercises:
        exercise["exercise_id"] = id_by_name.get(str(exercise.get("exercise_name", "")).strip().lower())


WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def _normalize_groups(plan_json: dict) -> None:
    """
    Keeps plan_json["groups"] to well-formed exercise groups: drops non-dict
    entries, and trims "weekdays" to known keys in week order with each
    weekday on one group only (the first that claims it), so the app can map
    "today" to a single group.
    """
    groups = [g for g in plan_json.get("groups") or [] if isinstance(g, dict)]
    claimed: set[str] = set()
    for group in groups:
        raw = group.get("weekdays")
        picked = {str(d).strip().lower()[:3] for d in raw} if isinstance(raw, list) else set()
        group["weekdays"] = [d for d in WEEKDAYS if d in picked and d not in claimed]
        claimed.update(group["weekdays"])
        group["name"] = str(group.get("name") or group.get("focus") or "Workout").strip()
        group["focus"] = str(group.get("focus") or "").strip()
        group["warmup"] = [w for w in group.get("warmup") or [] if isinstance(w, dict)]
        group["exercises"] = [e for e in group.get("exercises") or [] if isinstance(e, dict)]
    plan_json["groups"] = [g for g in groups if g["exercises"]]
    plan_json.pop("days", None)


def _parse_plan_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            return json.loads(match.group(0))
        raise PlanParseError("Failed to parse plan JSON from Claude response") from None


async def generate_plan_for_user(db: Session, user_id: UUID, preferences: dict | None = None) -> tuple[dict, dict]:
    """Returns (plan_json, source_summary_json) — the caller persists these to generated_plans."""
    provider, api_key = resolve_provider_and_key(db, user_id)
    if not api_key:
        raise NoAIKeyAvailable(
            f"No {PROVIDER_NAMES[provider]} API key available. Add your own key in Settings, "
            "switch AI provider, or configure a shared key on the server."
        )

    preferences = preferences or {}
    plan_equipment = preferences.get("equipment")
    prompt_input = _build_prompt_input(db, user_id, plan_equipment)
    prompt_input.plan_equipment = display_names(plan_equipment) if plan_equipment is not None else None
    prompt_input.training_days = preferences.get("training_days") or []
    prompt_input.day_focus = preferences.get("day_focus") or {}
    if preferences.get("include_warmup") is not None:
        # Asked per plan on the preferences screen; overrides the stored profile default.
        prompt_input.include_warmup = preferences["include_warmup"]
    prompt_input.session_minutes = preferences.get("session_minutes")
    prompt_input.notes = preferences.get("notes")
    prompt = build_plan_prompt(prompt_input)

    text, model_used = await generate_text(provider, api_key, prompt, max_tokens=2500)
    plan_json = _parse_plan_json(text)
    if not isinstance(plan_json, dict):
        raise PlanParseError("Failed to parse plan JSON from the AI response")
    _normalize_groups(plan_json)
    if not plan_json["groups"]:
        raise PlanParseError("The AI returned no exercise groups. Please try again.")
    _attach_exercise_ids(db, plan_json)

    source_summary = {
        "total_workouts_last_28_days": prompt_input.recent_workout_summary.total_workouts_last_28_days,
        "avg_workouts_per_week": prompt_input.recent_workout_summary.avg_workouts_per_week,
        "most_frequent_exercises": prompt_input.recent_workout_summary.most_frequent_exercises,
        "recent_feedback": prompt_input.recent_workout_summary.recent_feedback,
        # Saved with the plan so the app can pre-fill the same choices next time.
        "preferences": preferences,
        "provider": provider,
        "model": model_used,
    }
    return plan_json, source_summary
