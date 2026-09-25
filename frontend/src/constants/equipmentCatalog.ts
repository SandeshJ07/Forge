/**
 * Individual equipment the user can pick per plan. Keys mirror
 * backend/app/services/equipment_catalog.py — keep them in sync.
 */
export const EQUIPMENT_GROUPS: { title: string; items: { value: string; label: string }[] }[] = [
  {
    title: 'Free weights',
    items: [
      { value: 'barbell', label: 'Barbell' },
      { value: 'dumbbells', label: 'Dumbbells' },
      { value: 'kettlebells', label: 'Kettlebells' },
      { value: 'ez_bar', label: 'EZ curl bar' },
    ],
  },
  {
    title: 'Racks & benches',
    items: [
      { value: 'squat_rack', label: 'Squat / power rack' },
      { value: 'bench', label: 'Bench' },
      { value: 'pull_up_bar', label: 'Pull-up bar' },
      { value: 'dip_station', label: 'Dip station' },
      { value: 'plyo_box', label: 'Plyo box' },
    ],
  },
  {
    title: 'Machines',
    items: [
      { value: 'smith_machine', label: 'Smith machine' },
      { value: 'leg_press', label: 'Leg press' },
      { value: 'hack_squat', label: 'Hack squat' },
      { value: 'leg_extension', label: 'Leg extension' },
      { value: 'leg_curl', label: 'Leg curl' },
      { value: 'chest_press_machine', label: 'Chest press' },
      { value: 'pec_deck', label: 'Pec deck / fly' },
      { value: 'shoulder_press_machine', label: 'Shoulder press' },
      { value: 'lat_pulldown', label: 'Lat pulldown' },
      { value: 'seated_row', label: 'Seated cable row' },
      { value: 'cable_crossover', label: 'Cable crossover' },
      { value: 'calf_raise_machine', label: 'Calf raise' },
      { value: 'hip_thrust_machine', label: 'Hip thrust / glute' },
      { value: 'assisted_pull_up', label: 'Assisted pull-up' },
    ],
  },
  {
    title: 'Cardio',
    items: [
      { value: 'treadmill', label: 'Treadmill' },
      { value: 'stationary_bike', label: 'Bike' },
      { value: 'rowing_machine', label: 'Rower' },
      { value: 'elliptical', label: 'Elliptical' },
      { value: 'stair_climber', label: 'Stair climber' },
    ],
  },
  {
    title: 'Other',
    items: [
      { value: 'bands', label: 'Resistance bands' },
      { value: 'medicine_ball', label: 'Medicine ball' },
      { value: 'stability_ball', label: 'Stability ball' },
      { value: 'suspension_trainer', label: 'TRX / suspension' },
      { value: 'battle_ropes', label: 'Battle ropes' },
    ],
  },
];

export const ALL_EQUIPMENT = EQUIPMENT_GROUPS.flatMap((g) => g.items.map((i) => i.value));

/** Onboarding's broad choices → sensible individual defaults, for users who haven't picked per-plan yet. */
const FROM_PROFILE: Record<string, string[]> = {
  barbell: ['barbell', 'squat_rack', 'bench', 'ez_bar'],
  dumbbell: ['dumbbells', 'bench'],
  machine: [
    'smith_machine', 'leg_press', 'leg_extension', 'leg_curl', 'chest_press_machine', 'pec_deck',
    'lat_pulldown', 'seated_row', 'cable_crossover', 'calf_raise_machine',
  ],
  bodyweight: ['pull_up_bar', 'dip_station'],
  kettlebell: ['kettlebells'],
  bands: ['bands'],
};

/** A typical commercial gym — used when the profile says nothing about equipment. */
const STANDARD_GYM = [
  'barbell', 'dumbbells', 'ez_bar', 'squat_rack', 'bench', 'pull_up_bar', 'dip_station', 'smith_machine',
  'leg_press', 'leg_extension', 'leg_curl', 'chest_press_machine', 'pec_deck', 'lat_pulldown', 'seated_row',
  'cable_crossover', 'calf_raise_machine', 'treadmill', 'stationary_bike', 'rowing_machine',
];

export function defaultEquipmentFor(profileEquipment: string[] | null | undefined): string[] {
  if (!profileEquipment?.length) return STANDARD_GYM;
  const picked = new Set(profileEquipment.flatMap((e) => FROM_PROFILE[e] ?? []));
  return ALL_EQUIPMENT.filter((e) => picked.has(e));
}
