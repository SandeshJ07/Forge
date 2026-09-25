"""
Individual equipment a user can pick per plan (Plan preferences screen).
Each item maps to a display name for the prompt and to the free-exercise-db
`equipment` values it unlocks when choosing which glossary exercises to offer.
Keep keys in sync with frontend/src/constants/equipmentCatalog.ts.
"""

EQUIPMENT_CATALOG: dict[str, tuple[str, tuple[str, ...]]] = {
    # Free weights
    "barbell": ("Barbell", ("barbell",)),
    "dumbbells": ("Dumbbells", ("dumbbell",)),
    "kettlebells": ("Kettlebells", ("kettlebells",)),
    "ez_bar": ("EZ curl bar", ("e-z curl bar",)),
    # Racks & benches
    "squat_rack": ("Squat / power rack", ()),  # needs a barbell to be useful
    "bench": ("Flat / adjustable bench", ()),  # enables bench variants of whatever weights are picked
    "pull_up_bar": ("Pull-up bar", ("body only",)),
    "dip_station": ("Dip station", ("body only",)),
    "plyo_box": ("Plyo box", ("body only", "other")),
    # Machines
    "smith_machine": ("Smith machine", ("machine",)),
    "leg_press": ("Leg press", ("machine",)),
    "hack_squat": ("Hack squat machine", ("machine",)),
    "leg_extension": ("Leg extension machine", ("machine",)),
    "leg_curl": ("Leg curl machine", ("machine",)),
    "chest_press_machine": ("Chest press machine", ("machine",)),
    "pec_deck": ("Pec deck / fly machine", ("machine",)),
    "shoulder_press_machine": ("Shoulder press machine", ("machine",)),
    "lat_pulldown": ("Lat pulldown", ("cable", "machine")),
    "seated_row": ("Seated cable row", ("cable",)),
    "cable_crossover": ("Cable crossover / functional trainer", ("cable",)),
    "calf_raise_machine": ("Calf raise machine", ("machine",)),
    "hip_thrust_machine": ("Hip thrust / glute machine", ("machine",)),
    "assisted_pull_up": ("Assisted pull-up / dip machine", ("machine",)),
    # Cardio
    "treadmill": ("Treadmill", ("machine", "other")),
    "stationary_bike": ("Stationary bike", ("machine", "other")),
    "rowing_machine": ("Rowing machine", ("machine", "other")),
    "elliptical": ("Elliptical", ("machine", "other")),
    "stair_climber": ("Stair climber", ("machine", "other")),
    # Other
    "bands": ("Resistance bands", ("bands",)),
    "medicine_ball": ("Medicine ball", ("medicine ball",)),
    "stability_ball": ("Stability ball", ("exercise ball",)),
    "suspension_trainer": ("TRX / suspension trainer", ("body only", "other")),
    "battle_ropes": ("Battle ropes", ("other",)),
}

EQUIPMENT_KEYS: tuple[str, ...] = tuple(EQUIPMENT_CATALOG)


def display_names(keys: list[str]) -> list[str]:
    return [EQUIPMENT_CATALOG[k][0] for k in keys if k in EQUIPMENT_CATALOG]


def glossary_equipment(keys: list[str]) -> set[str]:
    """free-exercise-db equipment values unlocked by the picked items (bodyweight always included)."""
    values = {"body only"}
    for key in keys:
        values.update(EQUIPMENT_CATALOG.get(key, ("", ()))[1])
    return values
