import profiles from './seasonProgression.json';

/** Finite bounded presentation rules; malformed timing fails back to the legacy snow consumer. */
export function validSnowMotion(value: unknown): value is typeof profiles.snowWeather {
  if (typeof value !== 'object' || value === null) return false;
  for (const key of ['cell', 'interval', 'maxLife', 'overscan', 'domain', 'speed', 'drift', 'bandCell', 'bandInterval', 'bandLife', 'bandSpeed']) {
    const item: unknown = Reflect.get(value, key);
    if (typeof item !== 'number' || !Number.isFinite(item) || item <= 0 || item > 100_000) return false;
  }
  const cell: unknown = Reflect.get(value, 'cell'), interval: unknown = Reflect.get(value, 'interval');
  const life: unknown = Reflect.get(value, 'maxLife'), overscan: unknown = Reflect.get(value, 'overscan');
  const bandCell: unknown = Reflect.get(value, 'bandCell'), bandInterval: unknown = Reflect.get(value, 'bandInterval'), bandLife: unknown = Reflect.get(value, 'bandLife');
  if (typeof bandCell !== 'number' || bandCell < 32 || typeof bandInterval !== 'number' || bandInterval < 0.5 || typeof bandLife !== 'number' || bandLife > 10) return false;
  return typeof cell === 'number' && cell >= 32 && typeof interval === 'number' && interval >= 0.5 && typeof life === 'number' && life <= 10 && typeof overscan === 'number' && overscan <= 128;
}
export const SNOW_MOTION = validSnowMotion(profiles.snowWeather) ? profiles.snowWeather : null;
export const SNOW_FOOTPRINTS = profiles.snowFootprints;

export function validFootprintRules(value: unknown): value is typeof profiles.snowFootprints {
  if (typeof value !== 'object' || value === null) return false;
  for (const key of ['maxWalkers', 'maxSamples', 'maxPrints', 'lifeTicks', 'maxStep', 'minStep', 'stripLength', 'slope', 'tolerance', 'minAccumulation']) {
    const item: unknown = Reflect.get(value, key);
    if (typeof item !== 'number' || !Number.isFinite(item) || item <= 0 || item > 256) return false;
  }
  const walkers: unknown = Reflect.get(value, 'maxWalkers'), samples: unknown = Reflect.get(value, 'maxSamples'), prints: unknown = Reflect.get(value, 'maxPrints');
  if (typeof walkers !== 'number' || !Number.isInteger(walkers) || walkers > 64 || typeof samples !== 'number' || !Number.isInteger(samples) || samples < 2 || samples > 24 || typeof prints !== 'number' || !Number.isInteger(prints) || prints > 128) return false;
  const minStep: unknown = Reflect.get(value, 'minStep'), maxStep: unknown = Reflect.get(value, 'maxStep');
  const length: unknown = Reflect.get(value, 'stripLength'), accumulation: unknown = Reflect.get(value, 'minAccumulation');
  return typeof minStep === 'number' && typeof maxStep === 'number' && minStep <= maxStep
    && typeof length === 'number' && length <= maxStep * (samples - 1)
    && typeof accumulation === 'number' && accumulation <= 1;
}
export const SNOW_FOOTPRINTS_VALID = validFootprintRules(SNOW_FOOTPRINTS);
