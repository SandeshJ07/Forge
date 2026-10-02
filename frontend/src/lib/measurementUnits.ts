/** Converts between the units measurements are logged in (kg/lb, cm/in); other units pass through. */
const TO_BASE: Record<string, number> = { kg: 1, lb: 0.45359237, cm: 1, in: 2.54 };
const FAMILY: Record<string, string> = { kg: 'mass', lb: 'mass', cm: 'length', in: 'length' };

export function convertMeasurement(value: number, from: string, to: string): number {
  if (from === to || !TO_BASE[from] || !TO_BASE[to] || FAMILY[from] !== FAMILY[to]) return value;
  return (value * TO_BASE[from]) / TO_BASE[to];
}

/** 72 → "72", 72.25 → "72.3" — one decimal at most, none when whole. */
export function formatMeasurement(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
