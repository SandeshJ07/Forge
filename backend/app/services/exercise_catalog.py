"""
Curation layer on top of free-exercise-db: clearer names, how each exercise is
logged (tracking type), and common movements the dataset lacks.

Naming follows the convention of popular trackers (Hevy, Strong):
"Movement (Equipment)", e.g. "Bench Press (Barbell)", "Running (Treadmill)".
The old dataset name is kept in `aliases` so search and older plans still match.

Tracking types (modelled on Hevy's exercise types):
- weight_reps          — weight × reps (bench press)
- bodyweight_reps      — reps only (push-ups, box jumps)
- weighted_bodyweight  — reps, with optional added weight (pull-ups, dips)
- duration             — time only (plank, jump rope, stretches)
- distance_duration    — distance + time (treadmill run, rowing)
- weight_distance      — weight carried/pushed + distance (farmer's walk, sled push)

Used by the exercise catalog migration and the seed script. Keep
TRACKING_TYPES in sync with frontend/src/lib/tracking.ts.
"""

import re

TRACKING_TYPES = (
    "weight_reps",
    "bodyweight_reps",
    "weighted_bodyweight",
    "duration",
    "distance_duration",
    "weight_distance",
)

# free-exercise-db name -> curated name.
RENAMES: dict[str, str] = {
    # Chest
    "Barbell Bench Press - Medium Grip": "Bench Press (Barbell)",
    "Wide-Grip Barbell Bench Press": "Wide-Grip Bench Press (Barbell)",
    "Close-Grip Barbell Bench Press": "Close-Grip Bench Press (Barbell)",
    "Barbell Incline Bench Press - Medium Grip": "Incline Bench Press (Barbell)",
    "Decline Barbell Bench Press": "Decline Bench Press (Barbell)",
    "Dumbbell Bench Press": "Bench Press (Dumbbell)",
    "Incline Dumbbell Press": "Incline Bench Press (Dumbbell)",
    "Decline Dumbbell Bench Press": "Decline Bench Press (Dumbbell)",
    "Dumbbell Flyes": "Chest Fly (Dumbbell)",
    "Incline Dumbbell Flyes": "Incline Chest Fly (Dumbbell)",
    "Dumbbell Floor Press": "Floor Press (Dumbbell)",
    "Floor Press": "Floor Press (Barbell)",
    "Smith Machine Bench Press": "Bench Press (Smith Machine)",
    "Smith Machine Incline Bench Press": "Incline Bench Press (Smith Machine)",
    "Machine Bench Press": "Chest Press (Machine)",
    "Leverage Chest Press": "Chest Press (Plate-Loaded)",
    "Leverage Incline Chest Press": "Incline Chest Press (Plate-Loaded)",
    "Leverage Decline Chest Press": "Decline Chest Press (Plate-Loaded)",
    "Butterfly": "Pec Deck (Machine)",
    "Cable Crossover": "Cable Crossover (Cable)",
    "Low Cable Crossover": "Low-to-High Cable Fly (Cable)",
    "Flat Bench Cable Flyes": "Chest Fly (Cable)",
    "Incline Cable Flye": "Incline Chest Fly (Cable)",
    "Cable Chest Press": "Chest Press (Cable)",
    "Pushups": "Push-Up",
    "Push-Up Wide": "Wide Push-Up",
    "Push-Ups - Close Triceps Position": "Diamond Push-Up",
    "Push-Ups With Feet Elevated": "Decline Push-Up (Feet Elevated)",
    "Incline Push-Up": "Incline Push-Up",
    "Dips - Chest Version": "Chest Dip",
    "Straight-Arm Dumbbell Pullover": "Pullover (Dumbbell)",
    # Back
    "Barbell Deadlift": "Deadlift (Barbell)",
    "Sumo Deadlift": "Sumo Deadlift (Barbell)",
    "Trap Bar Deadlift": "Deadlift (Trap Bar)",
    "Romanian Deadlift": "Romanian Deadlift (Barbell)",
    "Stiff-Legged Barbell Deadlift": "Stiff-Leg Deadlift (Barbell)",
    "Stiff-Legged Dumbbell Deadlift": "Romanian Deadlift (Dumbbell)",
    "Rack Pulls": "Rack Pull (Barbell)",
    "Bent Over Barbell Row": "Bent Over Row (Barbell)",
    "Reverse Grip Bent-Over Rows": "Underhand Row (Barbell)",
    "One-Arm Dumbbell Row": "Single-Arm Row (Dumbbell)",
    "Bent Over Two-Dumbbell Row": "Bent Over Row (Dumbbell)",
    "Dumbbell Incline Row": "Chest-Supported Row (Dumbbell)",
    "T-Bar Row with Handle": "T-Bar Row",
    "Lying T-Bar Row": "Chest-Supported T-Bar Row (Machine)",
    "Seated Cable Rows": "Seated Row (Cable)",
    "Seated One-arm Cable Pulley Rows": "Single-Arm Seated Row (Cable)",
    "Leverage Iso Row": "Seated Row (Machine)",
    "Leverage High Row": "High Row (Machine)",
    "Smith Machine Bent Over Row": "Bent Over Row (Smith Machine)",
    "Wide-Grip Lat Pulldown": "Lat Pulldown (Cable)",
    "Close-Grip Front Lat Pulldown": "Close-Grip Lat Pulldown (Cable)",
    "V-Bar Pulldown": "V-Bar Lat Pulldown (Cable)",
    "Underhand Cable Pulldowns": "Reverse-Grip Lat Pulldown (Cable)",
    "One Arm Lat Pulldown": "Single-Arm Lat Pulldown (Cable)",
    "Straight-Arm Pulldown": "Straight-Arm Pulldown (Cable)",
    "Rope Straight-Arm Pulldown": "Straight-Arm Pulldown (Rope)",
    "Pullups": "Pull-Up",
    "Chin-Up": "Chin-Up",
    "Weighted Pull Ups": "Pull-Up (Weighted)",
    "Band Assisted Pull-Up": "Pull-Up (Band-Assisted)",
    "Inverted Row": "Inverted Row",
    "Hyperextensions (Back Extensions)": "Back Extension",
    "Face Pull": "Face Pull (Cable)",
    "Barbell Shrug": "Shrug (Barbell)",
    "Dumbbell Shrug": "Shrug (Dumbbell)",
    "Good Morning": "Good Morning (Barbell)",
    # Shoulders
    "Standing Military Press": "Overhead Press (Barbell)",
    "Seated Barbell Military Press": "Seated Overhead Press (Barbell)",
    "Barbell Shoulder Press": "Shoulder Press (Barbell)",
    "Dumbbell Shoulder Press": "Shoulder Press (Dumbbell)",
    "Seated Dumbbell Press": "Seated Shoulder Press (Dumbbell)",
    "Standing Dumbbell Press": "Standing Shoulder Press (Dumbbell)",
    "Arnold Dumbbell Press": "Arnold Press (Dumbbell)",
    "Machine Shoulder (Military) Press": "Shoulder Press (Machine)",
    "Leverage Shoulder Press": "Shoulder Press (Plate-Loaded)",
    "Smith Machine Overhead Shoulder Press": "Shoulder Press (Smith Machine)",
    "Push Press": "Push Press (Barbell)",
    "Side Lateral Raise": "Lateral Raise (Dumbbell)",
    "Seated Side Lateral Raise": "Seated Lateral Raise (Dumbbell)",
    "Cable Seated Lateral Raise": "Lateral Raise (Cable)",
    "Front Dumbbell Raise": "Front Raise (Dumbbell)",
    "Front Cable Raise": "Front Raise (Cable)",
    "Front Plate Raise": "Front Raise (Plate)",
    "Reverse Flyes": "Rear Delt Fly (Dumbbell)",
    "Seated Bent-Over Rear Delt Raise": "Seated Rear Delt Fly (Dumbbell)",
    "Cable Rear Delt Fly": "Rear Delt Fly (Cable)",
    "Reverse Machine Flyes": "Reverse Pec Deck (Machine)",
    "Upright Barbell Row": "Upright Row (Barbell)",
    "Upright Cable Row": "Upright Row (Cable)",
    "Band Pull Apart": "Band Pull-Apart",
    "External Rotation with Cable": "External Rotation (Cable)",
    "External Rotation with Band": "External Rotation (Band)",
    # Arms
    "Barbell Curl": "Bicep Curl (Barbell)",
    "EZ-Bar Curl": "Bicep Curl (EZ Bar)",
    "Dumbbell Bicep Curl": "Bicep Curl (Dumbbell)",
    "Dumbbell Alternate Bicep Curl": "Alternating Bicep Curl (Dumbbell)",
    "Hammer Curls": "Hammer Curl (Dumbbell)",
    "Alternate Hammer Curl": "Alternating Hammer Curl (Dumbbell)",
    "Cable Hammer Curls - Rope Attachment": "Hammer Curl (Rope)",
    "Incline Dumbbell Curl": "Incline Curl (Dumbbell)",
    "Concentration Curls": "Concentration Curl (Dumbbell)",
    "Preacher Curl": "Preacher Curl (Barbell)",
    "Machine Preacher Curls": "Preacher Curl (Machine)",
    "Cable Preacher Curl": "Preacher Curl (Cable)",
    "Standing Biceps Cable Curl": "Bicep Curl (Cable)",
    "Machine Bicep Curl": "Bicep Curl (Machine)",
    "Reverse Barbell Curl": "Reverse Curl (Barbell)",
    "Spider Curl": "Spider Curl (EZ Bar)",
    "Zottman Curl": "Zottman Curl (Dumbbell)",
    "Triceps Pushdown": "Triceps Pushdown (Cable)",
    "Triceps Pushdown - Rope Attachment": "Triceps Pushdown (Rope)",
    "Triceps Pushdown - V-Bar Attachment": "Triceps Pushdown (V-Bar)",
    "Reverse Grip Triceps Pushdown": "Reverse-Grip Triceps Pushdown (Cable)",
    "Triceps Overhead Extension with Rope": "Overhead Triceps Extension (Rope)",
    "Cable One Arm Tricep Extension": "Single-Arm Triceps Extension (Cable)",
    "EZ-Bar Skullcrusher": "Skull Crusher (EZ Bar)",
    "Lying Triceps Press": "Skull Crusher (Barbell)",
    "Lying Dumbbell Tricep Extension": "Skull Crusher (Dumbbell)",
    "Standing Dumbbell Triceps Extension": "Overhead Triceps Extension (Dumbbell)",
    "Seated Triceps Press": "Seated Overhead Triceps Extension (Dumbbell)",
    "Tricep Dumbbell Kickback": "Triceps Kickback (Dumbbell)",
    "Machine Triceps Extension": "Triceps Extension (Machine)",
    "Dips - Triceps Version": "Triceps Dip",
    "Bench Dips": "Bench Dip",
    "Weighted Bench Dip": "Bench Dip (Weighted)",
    "Parallel Bar Dip": "Parallel Bar Dip",
    "Dip Machine": "Assisted Dip (Machine)",
    "Palms-Up Barbell Wrist Curl Over A Bench": "Wrist Curl (Barbell)",
    "Palms-Down Wrist Curl Over A Bench": "Reverse Wrist Curl (Barbell)",
    # Legs
    "Barbell Squat": "Squat (Barbell)",
    "Barbell Full Squat": "Full Squat (Barbell)",
    "Front Barbell Squat": "Front Squat (Barbell)",
    "Box Squat": "Box Squat (Barbell)",
    "Smith Machine Squat": "Squat (Smith Machine)",
    "Goblet Squat": "Goblet Squat (Kettlebell)",
    "Dumbbell Squat": "Squat (Dumbbell)",
    "Bodyweight Squat": "Air Squat",
    "Hack Squat": "Hack Squat (Machine)",
    "Barbell Hack Squat": "Hack Squat (Barbell)",
    "Leg Press": "Leg Press (Machine)",
    "Leg Extensions": "Leg Extension (Machine)",
    "Lying Leg Curls": "Lying Leg Curl (Machine)",
    "Seated Leg Curl": "Seated Leg Curl (Machine)",
    "Standing Leg Curl": "Standing Leg Curl (Machine)",
    "Barbell Lunge": "Lunge (Barbell)",
    "Dumbbell Lunges": "Lunge (Dumbbell)",
    "Dumbbell Rear Lunge": "Reverse Lunge (Dumbbell)",
    "Barbell Walking Lunge": "Walking Lunge (Barbell)",
    "Bodyweight Walking Lunge": "Walking Lunge",
    "Split Squat with Dumbbells": "Split Squat (Dumbbell)",
    "Dumbbell Step Ups": "Step-Up (Dumbbell)",
    "Barbell Step Ups": "Step-Up (Barbell)",
    "Barbell Hip Thrust": "Hip Thrust (Barbell)",
    "Barbell Glute Bridge": "Glute Bridge (Barbell)",
    "Butt Lift (Bridge)": "Glute Bridge",
    "Single Leg Glute Bridge": "Single-Leg Glute Bridge",
    "Glute Kickback": "Glute Kickback",
    "One-Legged Cable Kickback": "Glute Kickback (Cable)",
    "Pull Through": "Pull-Through (Cable)",
    "Thigh Abductor": "Hip Abduction (Machine)",
    "Thigh Adductor": "Hip Adduction (Machine)",
    "Glute Ham Raise": "Glute-Ham Raise",
    "Standing Calf Raises": "Standing Calf Raise (Machine)",
    "Seated Calf Raise": "Seated Calf Raise (Machine)",
    "Standing Dumbbell Calf Raise": "Calf Raise (Dumbbell)",
    "Smith Machine Calf Raise": "Calf Raise (Smith Machine)",
    "Calf Press On The Leg Press Machine": "Calf Press (Leg Press)",
    "Kettlebell One-Legged Deadlift": "Single-Leg Romanian Deadlift (Kettlebell)",
    # Core
    "Crunches": "Crunch",
    "Cable Crunch": "Cable Crunch (Cable)",
    "Ab Crunch Machine": "Crunch (Machine)",
    "Hanging Leg Raise": "Hanging Leg Raise",
    "Knee/Hip Raise On Parallel Bars": "Captain's Chair Knee Raise",
    "Flat Bench Lying Leg Raise": "Lying Leg Raise",
    "Air Bike": "Bicycle Crunch",
    "Ab Roller": "Ab Wheel Rollout",
    "Side Bridge": "Side Plank",
    "Pallof Press": "Pallof Press (Cable)",
    "Standing Cable Wood Chop": "Wood Chop (Cable)",
    "Dumbbell Side Bend": "Side Bend (Dumbbell)",
    # Kettlebell / full body
    "One-Arm Kettlebell Swings": "Single-Arm Swing (Kettlebell)",
    "Kettlebell Turkish Get-Up (Squat style)": "Turkish Get-Up (Kettlebell)",
    "Kettlebell Thruster": "Thruster (Kettlebell)",
    "Power Clean": "Power Clean (Barbell)",
    "Clean and Jerk": "Clean and Jerk (Barbell)",
    "Snatch": "Snatch (Barbell)",
    "Farmer's Walk": "Farmer's Walk",
    "Battling Ropes": "Battle Ropes",
    "Sledgehammer Swings": "Sledgehammer Swing",
    "Box Jump (Multiple Response)": "Box Jump",
    "Freehand Jump Squat": "Jump Squat",
    "Mountain Climbers": "Mountain Climber",
    # Cardio
    "Running, Treadmill": "Running (Treadmill)",
    "Jogging, Treadmill": "Jogging (Treadmill)",
    "Walking, Treadmill": "Walking (Treadmill)",
    "Trail Running/Walking": "Trail Running / Hiking",
    "Bicycling": "Cycling (Outdoor)",
    "Bicycling, Stationary": "Cycling (Stationary Bike)",
    "Recumbent Bike": "Cycling (Recumbent Bike)",
    "Elliptical Trainer": "Elliptical Trainer",
    "Rowing, Stationary": "Rowing (Machine)",
    "Stairmaster": "Stair Climber (Machine)",
    "Step Mill": "Step Mill (Machine)",
    "Rope Jumping": "Jump Rope",
    "Prowler Sprint": "Prowler Sprint (Sled)",
    "Sled Push": "Sled Push",
    "Skating": "Skating",
}

# Common movements free-exercise-db doesn't have.
NEW_EXERCISES: list[dict] = [
    {
        "name": "Running (Outdoor)",
        "muscle_groups": ["quadriceps", "hamstrings", "calves"],
        "secondary_muscle_groups": ["glutes"],
        "equipment": "body only",
        "difficulty": "beginner",
        "category": "cardio",
        "tracking_type": "distance_duration",
        "instructions": [
            "Start with 5 minutes of easy jogging to warm up.",
            "Run tall with a slight forward lean, landing under your hips rather than out in front.",
            "Keep your shoulders relaxed and arms swinging front-to-back at about 90 degrees.",
            "Hold a pace where you can still speak in short sentences unless the plan calls for intervals.",
            "Finish with 3-5 minutes of walking to cool down.",
        ],
    },
    {
        "name": "Walking (Outdoor)",
        "muscle_groups": ["quadriceps", "calves"],
        "secondary_muscle_groups": ["glutes", "hamstrings"],
        "equipment": "body only",
        "difficulty": "beginner",
        "category": "cardio",
        "tracking_type": "distance_duration",
        "instructions": [
            "Walk briskly with an upright posture and your gaze ahead.",
            "Roll from heel to toe and swing your arms naturally.",
            "Aim for a pace that raises your breathing but still lets you talk.",
        ],
    },
    {
        "name": "Incline Walk (Treadmill)",
        "muscle_groups": ["glutes", "calves"],
        "secondary_muscle_groups": ["hamstrings", "quadriceps"],
        "equipment": "machine",
        "difficulty": "beginner",
        "category": "cardio",
        "tracking_type": "distance_duration",
        "instructions": [
            "Set the treadmill to a 8-15% incline and a walking speed of 4-6 km/h.",
            "Stand tall and let go of the handrails so your legs do the work.",
            "Take full strides, pushing through your whole foot.",
            "Lower the incline for the last 2 minutes to cool down.",
        ],
    },
    {
        "name": "Air Bike (Assault Bike)",
        "muscle_groups": ["quadriceps"],
        "secondary_muscle_groups": ["shoulders", "chest", "hamstrings"],
        "equipment": "machine",
        "difficulty": "intermediate",
        "category": "cardio",
        "tracking_type": "distance_duration",
        "instructions": [
            "Set the seat so your knee is slightly bent at the bottom of the pedal stroke.",
            "Push and pull the handles while you pedal, driving with legs and arms together.",
            "For intervals, sprint hard for the work period then pedal easily to recover.",
        ],
    },
    {
        "name": "Swimming",
        "muscle_groups": ["lats", "shoulders"],
        "secondary_muscle_groups": ["chest", "triceps", "quadriceps"],
        "equipment": "other",
        "difficulty": "intermediate",
        "category": "cardio",
        "tracking_type": "distance_duration",
        "instructions": [
            "Warm up with 100-200 m of easy swimming.",
            "Keep your body long and horizontal, with your head in line with your spine.",
            "Breathe rhythmically, exhaling underwater.",
            "Record total distance and time for the session.",
        ],
    },
    {
        "name": "Dead Hang",
        "muscle_groups": ["forearms"],
        "secondary_muscle_groups": ["lats", "shoulders"],
        "equipment": "body only",
        "difficulty": "beginner",
        "category": "strength",
        "tracking_type": "duration",
        "instructions": [
            "Grip a pull-up bar with hands shoulder-width apart, palms facing away.",
            "Hang with arms straight and let your shoulders rise slightly toward your ears.",
            "Breathe steadily and hold for the target time, then step down under control.",
        ],
    },
    {
        "name": "Wall Sit",
        "muscle_groups": ["quadriceps"],
        "secondary_muscle_groups": ["glutes", "calves"],
        "equipment": "body only",
        "difficulty": "beginner",
        "category": "strength",
        "tracking_type": "duration",
        "instructions": [
            "Stand with your back against a wall and feet about 60 cm in front of it.",
            "Slide down until your thighs are parallel to the floor and knees are over your ankles.",
            "Keep your back flat on the wall and hold for the target time.",
        ],
    },
    {
        "name": "Hollow Body Hold",
        "muscle_groups": ["abdominals"],
        "secondary_muscle_groups": [],
        "equipment": "body only",
        "difficulty": "intermediate",
        "category": "strength",
        "tracking_type": "duration",
        "instructions": [
            "Lie on your back and press your lower back into the floor.",
            "Lift your shoulders and legs a few centimetres off the floor, arms reaching overhead.",
            "Hold the banana shape without letting your lower back arch; bend the knees to make it easier.",
        ],
    },
    {
        "name": "Burpee",
        "muscle_groups": ["quadriceps", "chest"],
        "secondary_muscle_groups": ["shoulders", "triceps", "abdominals"],
        "equipment": "body only",
        "difficulty": "beginner",
        "category": "plyometrics",
        "tracking_type": "bodyweight_reps",
        "instructions": [
            "From standing, squat down and place your hands on the floor.",
            "Jump your feet back into a plank and do a push-up.",
            "Jump your feet back to your hands, then jump up with arms overhead.",
        ],
    },
    {
        "name": "Jumping Jack",
        "muscle_groups": ["calves"],
        "secondary_muscle_groups": ["shoulders", "quadriceps"],
        "equipment": "body only",
        "difficulty": "beginner",
        "category": "cardio",
        "tracking_type": "bodyweight_reps",
        "instructions": [
            "Stand with feet together and arms at your sides.",
            "Jump your feet out wide while swinging your arms overhead.",
            "Jump back to the start and repeat at a steady rhythm.",
        ],
    },
    {
        "name": "Bulgarian Split Squat (Dumbbell)",
        "muscle_groups": ["quadriceps", "glutes"],
        "secondary_muscle_groups": ["hamstrings"],
        "equipment": "dumbbell",
        "difficulty": "intermediate",
        "category": "strength",
        "tracking_type": "weight_reps",
        "instructions": [
            "Hold a dumbbell in each hand and rest the top of your rear foot on a bench behind you.",
            "Lower straight down until your front thigh is about parallel to the floor.",
            "Keep your front knee tracking over your toes and your torso upright.",
            "Drive through the front heel to stand; finish all reps, then switch legs.",
        ],
    },
    {
        "name": "Kettlebell Swing",
        "muscle_groups": ["glutes", "hamstrings"],
        "secondary_muscle_groups": ["lower back", "shoulders"],
        "equipment": "kettlebells",
        "difficulty": "intermediate",
        "category": "strength",
        "tracking_type": "weight_reps",
        "instructions": [
            "Stand with feet a little wider than hips, kettlebell on the floor in front of you.",
            "Hinge at the hips, grab the handle with both hands and hike it back between your legs.",
            "Snap your hips forward to float the bell to chest height; arms stay relaxed.",
            "Let it swing back down and hinge again to absorb it — the power comes from the hips, not a squat.",
        ],
    },
    {
        "name": "Hip Thrust (Machine)",
        "muscle_groups": ["glutes"],
        "secondary_muscle_groups": ["hamstrings"],
        "equipment": "machine",
        "difficulty": "beginner",
        "category": "strength",
        "tracking_type": "weight_reps",
        "instructions": [
            "Sit with your upper back against the pad and the belt or pad across your hips.",
            "Plant your feet shoulder-width apart so your shins are vertical at the top.",
            "Drive through your heels to lift your hips until your body is flat from knees to shoulders.",
            "Squeeze your glutes for a second, then lower under control.",
        ],
    },
    {
        "name": "Lat Pulldown (Machine)",
        "muscle_groups": ["lats"],
        "secondary_muscle_groups": ["biceps", "middle back"],
        "equipment": "machine",
        "difficulty": "beginner",
        "category": "strength",
        "tracking_type": "weight_reps",
        "instructions": [
            "Adjust the thigh pad so you're locked in, and grab the handles.",
            "Pull the handles down toward your upper chest, driving your elbows down and back.",
            "Pause briefly, then let your arms extend fully under control.",
        ],
    },
    {
        "name": "Leg Press (Plate-Loaded 45°)",
        "muscle_groups": ["quadriceps"],
        "secondary_muscle_groups": ["glutes", "hamstrings"],
        "equipment": "machine",
        "difficulty": "beginner",
        "category": "strength",
        "tracking_type": "weight_reps",
        "instructions": [
            "Sit with your back flat against the pad and feet shoulder-width on the platform.",
            "Release the safeties and lower the sled until your knees reach about 90 degrees.",
            "Keep your lower back on the pad, then press back up without locking your knees.",
        ],
    },
    {
        "name": "Suitcase Carry",
        "muscle_groups": ["abdominals", "forearms"],
        "secondary_muscle_groups": ["traps", "glutes"],
        "equipment": "dumbbell",
        "difficulty": "beginner",
        "category": "strongman",
        "tracking_type": "weight_distance",
        "instructions": [
            "Pick up a heavy dumbbell or kettlebell in one hand.",
            "Walk tall without leaning toward the weight — brace your core to stay level.",
            "Cover the target distance, then switch hands.",
        ],
    },
]

# Exact names (after renaming) whose tracking type the rules below would get wrong.
TRACKING_OVERRIDES: dict[str, str] = {
    "Plank": "duration",
    "Side Plank": "duration",
    "Battle Ropes": "duration",
    "Jump Rope": "duration",
    "Stair Climber (Machine)": "duration",
    "Step Mill (Machine)": "duration",
    "Isometric Chest Squeezes": "duration",
    "Isometric Neck Exercise - Front And Back": "duration",
    "Isometric Neck Exercise - Sides": "duration",
    "Balance Board": "duration",
    "Downward Facing Balance": "duration",
    "Wind Sprints": "distance_duration",
    "Prowler Sprint (Sled)": "weight_distance",
    "Farmer's Walk": "weight_distance",
    "Yoke Walk": "weight_distance",
    "Rickshaw Carry": "weight_distance",
    "Sled Push": "weight_distance",
    "Sled Drag - Harness": "weight_distance",
    "Backward Drag": "weight_distance",
    "Bear Crawl Sled Drags": "weight_distance",
    "Sled Overhead Backward Walk": "weight_distance",
    "Pull-Up": "weighted_bodyweight",
    "Pull-Up (Weighted)": "weighted_bodyweight",
    "Chin-Up": "weighted_bodyweight",
    "Chest Dip": "weighted_bodyweight",
    "Triceps Dip": "weighted_bodyweight",
    "Parallel Bar Dip": "weighted_bodyweight",
    "Ring Dips": "weighted_bodyweight",
    "Bench Dip (Weighted)": "weighted_bodyweight",
    "Back Extension": "weighted_bodyweight",
    "Mixed Grip Chin": "weighted_bodyweight",
    "V-Bar Pullup": "weighted_bodyweight",
    "Wide-Grip Rear Pull-Up": "weighted_bodyweight",
    "Pull-Up (Band-Assisted)": "bodyweight_reps",
    "Assisted Dip (Machine)": "weight_reps",
}

_BODYWEIGHT_OTHER = re.compile(
    r"chin|pull-?up|muscle up|suspended|inverted row|rope climb|parallel bars|london bridges|"
    r"hamstring slides|bodyweight|push-?up|otis-up",
    re.IGNORECASE,
)
_CARDIO_DURATION = re.compile(r"jump rope|stair|step mill", re.IGNORECASE)


def tracking_for(name: str, category: str | None, equipment: str | None) -> str:
    """How an exercise is logged. Rules first by override, then by dataset category and equipment."""
    if name in TRACKING_OVERRIDES:
        return TRACKING_OVERRIDES[name]
    if category == "stretching" or equipment == "foam roll":
        return "duration"
    if category == "cardio":
        return "duration" if _CARDIO_DURATION.search(name) else "distance_duration"
    if equipment in ("body only", None, "exercise ball"):
        return "bodyweight_reps"
    if equipment == "other" and (category == "plyometrics" or _BODYWEIGHT_OTHER.search(name)):
        return "bodyweight_reps"
    return "weight_reps"


def apply_catalog(conn) -> None:
    """
    Brings the exercises table in line with this module: renames (old name kept
    as an alias), adds the missing exercises, and sets every row's tracking_type.
    Idempotent. `conn` is a SQLAlchemy Connection (migration bind or session.connection()).
    """
    from sqlalchemy import text

    for old, new in RENAMES.items():
        if old == new:
            continue
        conn.execute(
            text(
                "UPDATE exercises SET name = :new, "
                "aliases = array_append(coalesce(aliases, '{}'), CAST(:old AS varchar)) "
                "WHERE name = :old"
            ),
            {"old": old, "new": new},
        )

    existing = {row[0].lower() for row in conn.execute(text("SELECT name FROM exercises"))}
    for exercise in NEW_EXERCISES:
        if exercise["name"].lower() in existing:
            continue
        conn.execute(
            text(
                "INSERT INTO exercises (id, name, muscle_groups, secondary_muscle_groups, equipment, difficulty, "
                "instructions, media_urls, category, source, tracking_type) VALUES (gen_random_uuid(), :name, "
                ":muscle_groups, :secondary_muscle_groups, :equipment, :difficulty, :instructions, '{}', :category, "
                "'forge', :tracking_type)"
            ),
            exercise,
        )

    rows = conn.execute(text("SELECT id, name, category, equipment FROM exercises WHERE source <> 'forge'")).all()
    for exercise_id, name, category, equipment in rows:
        conn.execute(
            text("UPDATE exercises SET tracking_type = :t WHERE id = :id"),
            {"t": tracking_for(name, category, equipment), "id": exercise_id},
        )
