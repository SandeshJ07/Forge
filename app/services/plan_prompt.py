"""
Isolated prompt template for AI plan generation. Kept separate from the
route/service plumbing so it's easy to find and tune independently.
"""

from dataclasses import dataclass, field


@dataclass
class WorkoutHistorySummary:
    total_workouts_last_28_days: int
    avg_workouts_per_week: float
    most_frequent_exercises: list[dict]  # [{"name": str, "count": int}]
    recent_feedback: list[dict]  # [{"felt_rating": str | None, "enjoyed": bool | None}]


@dataclass
class PersonalRecordSummary:
    name: str
    best_weight_kg: float
    best_weight_reps: int | None


@dataclass
class PlanGenerationInput:
    goal: str | None
    experience_level: str | None
    equipment_access: list[str] | None
    unit_system: str
    include_warmup: bool
    gender: str | None
    age: int | None
    height_cm: float | None
    latest_body_weight_kg: float | None
    recent_workout_summary: WorkoutHistorySummary
    liked_exercises: list[str]
    disliked_exercises: list[str]
    available_exercise_names: list[str]
    personal_records: list[PersonalRecordSummary] = field(default_factory=list)


def _build_plan_json_schema_description(include_warmup: bool) -> str:
    warmup_block = (
        """"warmup": [
        {
          "exercise_name": string (a light, joint-mobility or activation movement relevant to the day's focus),
          "duration_or_reps": string (e.g. "5 min" or "2x15"),
          "notes": string (optional)
        }
      ],"""
        if include_warmup
        else '"warmup": [],'
    )
    return f"""{{
  "title": string,
  "rationale": string (2-3 sentences explaining why this plan fits the user),
  "days": [
    {{
      "day_label": string (e.g. "Day 1 - Push"),
      "focus": string (e.g. "Chest, Shoulders, Triceps"),
      {warmup_block}
      "exercises": [
        {{
          "exercise_id": string | null (use the id from the provided exercise list if it matches, else null),
          "exercise_name": string,
          "sets": number,
          "reps": string (e.g. "8-10" or "AMRAP"),
          "rest_seconds": number,
          "notes": string (optional, brief coaching cue)
        }}
      ]
    }}
  ]
}}"""


def build_plan_prompt(data: PlanGenerationInput) -> str:
    """
    Builds a small, bounded prompt: no raw workout dumps, just a
    pre-aggregated summary. Keeps token usage (and cost) low since this is
    the one part of the stack with a real per-call price.
    """
    pr_rows = ", ".join(
        f"{pr.name}: {pr.best_weight_kg}kg" + (f" x{pr.best_weight_reps}" if pr.best_weight_reps else "")
        for pr in data.personal_records[:20]
    )

    summary = data.recent_workout_summary
    frequent_exercises = (
        ", ".join(f"{e['name']} ({e['count']}x)" for e in summary.most_frequent_exercises)
        or "none logged yet"
    )

    warmup_instruction = (
        "- Include a short (5-10 minute) warm-up of 2-4 movements for each training day, relevant to that day's focus."
        if data.include_warmup
        else '- Omit warm-ups entirely (return an empty "warmup" array for each day) — the athlete has opted out.'
    )

    return f"""You are a knowledgeable, safety-conscious strength & conditioning coach. Generate a one-week training plan for a single gym-goer based on the profile and recent training summary below.

## Athlete profile
- Goal: {data.goal or 'not specified, assume general fitness'}
- Experience level: {data.experience_level or 'not specified, assume beginner'}
- Equipment access: {', '.join(data.equipment_access) if data.equipment_access else 'assume standard commercial gym'}
- Units: {data.unit_system}
- Gender: {data.gender if data.gender and data.gender != 'prefer_not_to_say' else 'not specified'}
- Age: {data.age if data.age is not None else 'not specified'}
- Height: {f'{data.height_cm:.0f}cm' if data.height_cm else 'not specified'}
- Latest logged body weight: {f'{data.latest_body_weight_kg}kg' if data.latest_body_weight_kg else 'not specified'}

## Recent training (last 28 days)
- Total workouts: {summary.total_workouts_last_28_days}
- Average per week: {summary.avg_workouts_per_week:.1f}
- Most frequent exercises: {frequent_exercises}
- Recent workout feedback: {summary.recent_feedback}

## Personal records (heaviest weight logged per exercise — use these to set working weights/intensity, not just sets/reps)
{pr_rows or 'none logged yet'}

## Exercise preferences
- Liked/preferred: {', '.join(data.liked_exercises) or 'none marked'}
- Disliked (AVOID these entirely): {', '.join(data.disliked_exercises) or 'none marked'}

## Exercises available in the app's glossary (prefer these names/ids when possible; you may include other well-known exercises if needed)
{', '.join(data.available_exercise_names[:200])}

## Instructions
- Design a plan appropriate to the athlete's apparent experience level and recent volume — don't drastically increase volume if they've been training infrequently.
- Use age, gender, and body weight (where provided) only to sanity-check reasonable starting intensity and recovery expectations — never to gatekeep or exclude any exercise category.
- Strongly prefer liked/neutral exercises. Never include a disliked exercise.
- Where a personal record exists for an exercise you include, use it to suggest a sensible working weight or intensity cue in that exercise's "notes".
- 3-5 training days, balanced across muscle groups relative to the stated goal.
{warmup_instruction}
- Respond with ONLY valid JSON matching this exact shape, no markdown fences, no commentary:

{_build_plan_json_schema_description(data.include_warmup)}"""
