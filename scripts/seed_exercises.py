"""
One-time seed script: loads yuhonas/free-exercise-db's exercises.json
(MIT-licensed, no API key required) and inserts them into the `exercises`
table via SQLAlchemy, using this backend's own DATABASE_URL.

Usage (from backend/, with the venv active):
    python -m scripts.seed_exercises
"""

import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import SessionLocal  # noqa: E402
from app.models.exercise import Exercise  # noqa: E402

SOURCE_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"

# free-exercise-db ships local image paths (images/<slug>/0.jpg); the actual
# files live in the same repo, so this points at jsDelivr's raw CDN (free, no
# rate-limit auth needed for reasonable personal use) rather than bundling
# ~2GB of images into this repo or paying for image hosting.
MEDIA_BASE_URL = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises"

DIFFICULTY_MAP = {"beginner": "beginner", "intermediate": "intermediate", "expert": "advanced"}

BATCH_SIZE = 200


def main() -> None:
    print(f"Fetching exercise dataset from {SOURCE_URL} ...")
    response = httpx.get(SOURCE_URL, timeout=30, follow_redirects=True)
    response.raise_for_status()
    entries = response.json()
    print(f"Fetched {len(entries)} exercises.")

    db = SessionLocal()
    inserted = 0
    try:
        for i in range(0, len(entries), BATCH_SIZE):
            batch = entries[i : i + BATCH_SIZE]
            for entry in batch:
                images = entry.get("images") or []
                db.add(
                    Exercise(
                        name=entry["name"],
                        aliases=None,
                        muscle_groups=entry.get("primaryMuscles") or [],
                        secondary_muscle_groups=entry.get("secondaryMuscles") or [],
                        equipment=entry.get("equipment"),
                        difficulty=DIFFICULTY_MAP.get(entry.get("level")),
                        instructions=entry.get("instructions") or [],
                        media_url=f"{MEDIA_BASE_URL}/{images[0]}" if images else None,
                        media_type="image" if images else None,
                        category=entry.get("category"),
                        source="free-exercise-db",
                    )
                )
            db.commit()
            inserted += len(batch)
            print(f"Inserted {inserted}/{len(entries)}")
    finally:
        db.close()

    print("Done.")


if __name__ == "__main__":
    main()
