from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.exercise import Exercise
from app.models.run_route import RunRoute
from app.models.user import User
from app.models.workout import Workout, WorkoutSet
from app.schemas.run import RunRouteResponse, SaveRunRequest, SaveRunResponse
from app.services.runs import compute_run, pack_route, preview_of, unpack_route

router = APIRouter(prefix="/runs", tags=["runs"])

# The glossary exercise each recorded activity is logged as.
ACTIVITY_EXERCISE = {"run": "Running (Outdoor)", "walk": "Walking (Outdoor)", "ride": "Cycling (Outdoor)"}
ACTIVITY_TITLE = {"run": "Run", "walk": "Walk", "ride": "Ride"}


@router.post("", response_model=SaveRunResponse, status_code=status.HTTP_201_CREATED)
def save_run(
    body: SaveRunRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> SaveRunResponse:
    """
    Saves a GPS-recorded run as a normal workout (one distance & time set, so it
    counts in the log, streak and history) plus its route. Distance, moving time,
    splits and elevation are computed here from the points.
    """
    stats = compute_run([[p.model_dump() for p in seg] for seg in body.segments], body.activity)
    if not stats.segments or stats.distance_m < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not enough GPS movement was recorded to save this run.",
        )

    exercise_name = ACTIVITY_EXERCISE[body.activity]
    exercise = db.query(Exercise).filter(func.lower(Exercise.name) == exercise_name.lower()).first()
    started_at = body.started_at
    workout = Workout(
        user_id=current_user.id,
        source="manual",
        title=body.title.strip() or ACTIVITY_TITLE[body.activity],
        date=started_at,
        duration_seconds=body.elapsed_seconds,
        summary=f"{stats.distance_m / 1000:.2f} km recorded with GPS",
    )
    db.add(workout)
    db.flush()
    db.add(
        WorkoutSet(
            workout_id=workout.id,
            exercise_id=exercise.id if exercise else None,
            exercise_name_raw=exercise.name if exercise else exercise_name,
            set_index=0,
            distance_meters=stats.distance_m,
            duration_seconds=stats.moving_seconds,
            started_at=started_at,
            ended_at=started_at + timedelta(seconds=body.elapsed_seconds),
        )
    )
    db.add(
        RunRoute(
            workout_id=workout.id,
            user_id=current_user.id,
            activity=body.activity,
            distance_m=stats.distance_m,
            moving_seconds=stats.moving_seconds,
            elapsed_seconds=body.elapsed_seconds,
            elevation_gain_m=stats.elevation_gain_m,
            max_speed_mps=round(stats.max_speed_mps, 2),
            route=pack_route(stats.segments),
            preview=preview_of(stats.segments),
            splits=stats.splits,
            elevation_profile=stats.elevation_profile,
        )
    )
    db.commit()
    return SaveRunResponse(workout_id=workout.id, distance_m=stats.distance_m, moving_seconds=stats.moving_seconds)


@router.get("/{workout_id}", response_model=RunRouteResponse)
def get_run_route(
    workout_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> RunRouteResponse:
    route = db.get(RunRoute, workout_id)
    if route is None or route.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")
    return RunRouteResponse(
        workout_id=route.workout_id,
        activity=route.activity,
        distance_m=route.distance_m,
        moving_seconds=route.moving_seconds,
        elapsed_seconds=route.elapsed_seconds,
        elevation_gain_m=route.elevation_gain_m,
        max_speed_mps=route.max_speed_mps,
        segments=[[[p.lat, p.lng] for p in seg] for seg in unpack_route(route.route)],
        splits=route.splits,
        elevation_profile=route.elevation_profile,
    )
