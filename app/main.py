from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import anthropic_key, auth, exercises, measurements, personal_records, plans, profile, workouts
from app.core.config import get_settings

settings = get_settings()

Path(settings.storage_dir).mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Forge API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(exercises.router)
app.include_router(workouts.router)
app.include_router(measurements.router)
app.include_router(personal_records.router)
app.include_router(anthropic_key.router)
app.include_router(plans.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
