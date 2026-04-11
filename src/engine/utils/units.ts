const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

export function speedMpsToPaceSecPerMile(speedMps: number): number {
  return METERS_PER_MILE / speedMps;
}

export function paceSecPerMileToSpeedMps(paceSecPerMile: number): number {
  return METERS_PER_MILE / paceSecPerMile;
}

export function speedMpsToPaceSecPerKm(speedMps: number): number {
  return 1000 / speedMps;
}

export function paceSecPerKmToSpeedMps(paceSecPerKm: number): number {
  return 1000 / paceSecPerKm;
}

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export function milesToMeters(miles: number): number {
  return miles * METERS_PER_MILE;
}

export function metersToFeet(meters: number): number {
  return meters * FEET_PER_METER;
}

export { METERS_PER_MILE };
