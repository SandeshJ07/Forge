"""
Diet plan generation. Unlike workout plans, this only ever runs on the user's
own AI key: the server's shared key is reserved for workout plans.
"""

import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.integration_token import IntegrationToken
from app.models.measurement import Measurement
from app.models.profile import UserProfile
from app.models.workout import Workout
from app.services.ai_providers import AIProvider, generate_text


class NoOwnAIKey(Exception):
    pass


class DietPlanParseError(Exception):
    pass


@dataclass
class OwnKey:
    provider: AIProvider
    api_key: str


def resolve_own_key(db: Session, user_id: UUID) -> OwnKey | None:
    """The user's key for their chosen provider, else their key for the other one; None if they've added neither."""
    profile = db.get(UserProfile, user_id)
    chosen: AIProvider = profile.ai_provider if profile and profile.ai_provider in ("anthropic", "gemini") else "anthropic"
    other: AIProvider = "gemini" if chosen == "anthropic" else "anthropic"
    for provider in (chosen, other):
        token = db.get(IntegrationToken, (user_id, provider))
        if token is not None:
            return OwnKey(provider, token.access_token)
    return None


DIET_TYPE_RULES = {
    "vegetarian": "Vegetarian: no meat, poultry, fish, seafood or eggs. Dairy is fine.",
    "non_vegetarian": "Non-vegetarian: meat, poultry, fish, eggs and dairy are all fine; include plant meals too.",
    "vegan": "Vegan: no animal products at all — no meat, fish, eggs, dairy, honey, ghee, whey or gelatin.",
}
BUDGET_TEXT = {
    "low": "Tight budget — cheap staples (lentils, beans, rice, oats, seasonal vegetables, eggs/soy where allowed); no speciality products.",
    "moderate": "Moderate budget — everyday supermarket food; occasional pricier items are fine.",
    "flexible": "Budget isn't a concern.",
}
COOKING_TEXT = {
    "minimal": "Minimal cooking — most meals under 15 minutes, batch-cooking and no-cook options welcome.",
    "moderate": "Moderate cooking — around 30 minutes per meal is fine.",
    "plenty": "Enjoys cooking — longer recipes are fine.",
}
GOAL_TEXT = {
    "strength": "strength",
    "hypertrophy": "muscle gain",
    "general_fitness": "general fitness",
    "endurance": "endurance",
    "weight_loss": "weight loss",
}


def _latest_weight_kg(db: Session, user_id: UUID) -> float | None:
    row = (
        db.query(Measurement)
        .filter(Measurement.user_id == user_id, Measurement.type == "body_weight")
        .order_by(Measurement.date.desc())
        .first()
    )
    if row is None:
        return None
    value = float(row.value)
    return round(value * 0.453592, 1) if row.unit == "lb" else round(value, 1)


def build_diet_prompt(db: Session, user_id: UUID, preferences: dict) -> str:
    profile = db.get(UserProfile, user_id)
    since = datetime.now(timezone.utc) - timedelta(days=28)
    workouts_28d = db.query(Workout).filter(Workout.user_id == user_id, Workout.date >= since).count()

    about = []
    if profile and profile.gender:
        about.append(f"Gender: {profile.gender}")
    if profile and profile.birth_year:
        about.append(f"Age: {datetime.now(timezone.utc).year - profile.birth_year}")
    if profile and profile.height_cm:
        about.append(f"Height: {float(profile.height_cm):.0f} cm")
    weight = _latest_weight_kg(db, user_id)
    about.append(f"Current weight: {weight} kg" if weight else "Current weight: not logged")
    if preferences.get("target_weight_kg"):
        about.append(f"Target weight: {preferences['target_weight_kg']} kg")
    if profile and profile.goals:
        about.append("Training goals: " + ", ".join(GOAL_TEXT.get(g, g) for g in profile.goals))
    about.append(f"Workouts in the last 4 weeks: {workouts_28d} (about {workouts_28d / 4:.1f} a week)")

    # Plans saved before the cuisine field existed default to Indian too.
    cuisine = (preferences.get("cuisine") or "Indian").strip()
    wants = [
        DIET_TYPE_RULES[preferences["diet_type"]],
        f"Meals per day: exactly {preferences['meals_per_day']}.",
        f'Cuisine: base the meals on {cuisine} cuisine (the person\'s words: "{cuisine}") — familiar home-style '
        "dishes and ingredients from it, not fusion versions.",
    ]
    if preferences.get("budget"):
        wants.append(BUDGET_TEXT[preferences["budget"]])
    if preferences.get("cooking_time"):
        wants.append(COOKING_TEXT[preferences["cooking_time"]])

    about_block = "\n".join(f"- {a}" for a in about)
    wants_block = "\n".join(f"- {w}" for w in wants)
    notes = preferences.get("notes")
    notes_block = (
        f'\nThe person also wrote (treat allergies and medical conditions as strict rules):\n"""\n{notes}\n"""\n'
        if notes
        else ""
    )

    return f"""You are a registered sports dietitian (CSSD) who also coaches strength training in a gym. You plan
meals around training: enough protein spread across the day, carbohydrates timed around workouts, and food the
person will actually enjoy and can afford. Write a 7-day diet plan for this person.

About them:
{about_block}

Requirements:
{wants_block}
{notes_block}
Rules:
- Set daily calorie and macro targets from their stats, training and target weight. Aim for a sustainable pace:
  at most about 0.5-1% of body weight per week toward the target. Never go below 1200 kcal/day for women or
  1500 kcal/day for men (1400 if gender unknown). Protein roughly 1.6-2.2 g per kg of body weight when training.
- If key stats are missing, assume sensible averages and say so in "assumptions".
- Use real, easy-to-find foods. Give quantities as household measures with grams, e.g. "1 cup cooked rice (150 g)".
- Vary meals across the week but reuse ingredients so the shopping list stays short.
- Keep each meal's calories and protein realistic; each day's meals should add up close to the daily targets.
- Spread protein over the meals (roughly 20-40 g each) and put a carb-and-protein meal 1-3 hours before and
  within 2 hours after training.
- This is general guidance, not medical advice. If the notes mention a medical condition, pregnancy or an
  eating disorder, keep the plan conservative and add a tip to check it with a doctor or dietitian.

Respond with ONLY a JSON object, no markdown fences, in exactly this shape:
{{
  "title": "short plan name",
  "summary": "2-3 sentences on the approach",
  "assumptions": ["anything you had to assume"],
  "daily_targets": {{"calories": 2200, "protein_g": 140, "carbs_g": 240, "fat_g": 70}},
  "timeline": "e.g. About 10-14 weeks to reach 72 kg at this pace (null if no target weight)",
  "days": [
    {{
      "day": "Monday",
      "meals": [
        {{
          "name": "Breakfast",
          "time": "08:00",
          "items": ["2 besan chillas (120 g batter)", "1 cup curd (200 g)"],
          "calories": 450,
          "protein_g": 25,
          "prep_minutes": 15,
          "notes": "optional short tip or null"
        }}
      ]
    }}
  ],
  "shopping_list": ["item with weekly quantity"],
  "tips": ["3-6 short practical tips"]
}}
"days" must have all 7 days, Monday to Sunday, each with exactly {preferences['meals_per_day']} meals."""


def _parse_json(text: str) -> dict:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise DietPlanParseError("The AI's answer wasn't a diet plan. Please try again.") from None
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            raise DietPlanParseError("The AI's answer wasn't a diet plan. Please try again.") from None
    if not isinstance(data, dict):
        raise DietPlanParseError("The AI's answer wasn't a diet plan. Please try again.")
    return data


def _int_or_none(value) -> int | None:
    try:
        return round(float(value))
    except (TypeError, ValueError):
        return None


def _str_list(value) -> list[str]:
    return [str(v).strip() for v in value if str(v).strip()] if isinstance(value, list) else []


def normalize_diet_plan(data: dict) -> dict:
    """Keeps only the fields the app renders, with the right types; drops malformed days and meals."""
    days = []
    for day in data.get("days") or []:
        if not isinstance(day, dict):
            continue
        meals = []
        for meal in day.get("meals") or []:
            if not isinstance(meal, dict):
                continue
            items = _str_list(meal.get("items"))
            if not items:
                continue
            notes = meal.get("notes")
            meals.append(
                {
                    "name": str(meal.get("name") or "Meal").strip(),
                    "time": str(meal.get("time")).strip() if meal.get("time") else None,
                    "items": items,
                    "calories": _int_or_none(meal.get("calories")),
                    "protein_g": _int_or_none(meal.get("protein_g")),
                    "prep_minutes": _int_or_none(meal.get("prep_minutes")),
                    "notes": str(notes).strip() if notes and str(notes).strip().lower() != "null" else None,
                }
            )
        if meals:
            days.append({"day": str(day.get("day") or f"Day {len(days) + 1}").strip(), "meals": meals})
    if not days:
        raise DietPlanParseError("The AI's plan had no meals in it. Please try again.")

    raw_targets = data.get("daily_targets") if isinstance(data.get("daily_targets"), dict) else {}
    timeline = data.get("timeline")
    return {
        "title": str(data.get("title") or "Your diet plan").strip(),
        "summary": str(data.get("summary") or "").strip(),
        "assumptions": _str_list(data.get("assumptions")),
        "daily_targets": {k: _int_or_none(raw_targets.get(k)) for k in ("calories", "protein_g", "carbs_g", "fat_g")},
        "timeline": str(timeline).strip() if timeline and str(timeline).strip().lower() != "null" else None,
        "days": days,
        "shopping_list": _str_list(data.get("shopping_list")),
        "tips": _str_list(data.get("tips")),
    }


async def generate_diet_plan(db: Session, user_id: UUID, preferences: dict) -> tuple[dict, str, str]:
    """Returns (plan_json, provider, model). Raises NoOwnAIKey, DietPlanParseError or AIRequestError."""
    key = resolve_own_key(db, user_id)
    if key is None:
        raise NoOwnAIKey("Diet plans need your own Gemini or Claude API key. Add one in Settings.")
    prompt = build_diet_prompt(db, user_id, preferences)
    # 7 days x up to 6 meals, plus targets, shopping list and tips.
    text, model = await generate_text(key.provider, key.api_key, prompt, max_tokens=12000)
    return normalize_diet_plan(_parse_json(text)), key.provider, model
