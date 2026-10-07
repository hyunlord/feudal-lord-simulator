import type { ArtBundle, ArtPoint, WalkerArtDirection, WalkerHeldPropEntry } from './artContract';
import type { ArtSchemaIssue } from './schemaValidation';
import { matches, type ArtContext } from './artSelection';

const DIRECTIONS: readonly WalkerArtDirection[] = ['NE', 'SE', 'SW', 'NW'];
const fits = (point: ArtPoint, size: number): boolean => point.x >= 0 && point.y >= 0 && point.x < size && point.y < size;

export function validateWalkerArt(bundles: readonly ArtBundle[]): readonly ArtSchemaIssue[] {
  const issues: ArtSchemaIssue[] = [];
  const report = (id: string, message: string): void => { issues.push({ path: `$/entries/${id}`, message }); };
  const entries = bundles.flatMap(bundle => bundle.entries);
  const rules = bundles.flatMap(bundle => bundle.rules).sort((a, b) => b.priority - a.priority);
  for (const entry of entries) {
    if (entry.kind !== 'walker-body' && entry.kind !== 'walker-held-prop') continue;
    const context: ArtContext = entry.kind === 'walker-body'
      ? { bodyId: entry.id, classBand: entry.registration.classBand, sex: entry.registration.sex }
      : { propId: entry.propId, facing: entry.direction };
    const rule = rules.find(candidate => candidate.kind === entry.kind && candidate.slot === entry.kind && matches(candidate.conditions, context));
    if (!rule || rule.variants.length !== 1 || rule.variants[0]?.assetId !== entry.id) {
      report(entry.id, 'Composer selector must resolve its registered body or directional grip');
    }
  }
  const families = new Map<string, WalkerHeldPropEntry[]>();
  for (const bundle of bundles) {
    if (bundle.packId === undefined && bundle.entries.some(entry => entry.kind === 'walker-body' || entry.kind === 'walker-held-prop')) {
      report(bundle.bundleId, 'Walker composition bundles require explicit packId');
    }
  }
  for (const entry of entries) {
    if (entry.kind !== 'walker-held-prop') continue;
    const family = families.get(entry.propId) ?? [];
    family.push(entry); families.set(entry.propId, family);
    if (entry.image.width !== 32 || entry.image.height !== 32) report(entry.id, 'Held prop requires a 32px canvas');
    if (!fits(entry.anchor, 32)) report(entry.id, 'Grip is outside prop canvas');
    const bounds = entry.opaqueBounds;
    if (bounds.x + bounds.width > 32 || bounds.y + bounds.height > 32) report(entry.id, 'Opaque bounds are outside prop canvas');
    if (![32, entry.anchor.x, entry.anchor.y].every(value => Number.isFinite(value * entry.scale / (entry.referenceFigureHeight ?? 1)))) {
      report(entry.id, 'Scaled prop geometry overflows');
    }
  }
  for (const [id, family] of families) {
    if (family.length !== 4 || new Set(family.map(entry => entry.direction)).size !== 4) report(id, 'Prop family requires exactly four unique directions');
    const first = family[0];
    if (first && family.some(entry => entry.scale !== first.scale || entry.referenceFigureHeight !== first.referenceFigureHeight)) {
      report(id, 'Prop family scale must be consistent across directions');
    }
  }
  for (const entry of entries) {
    if (entry.kind !== 'walker-body') continue;
    const registration = entry.registration;
    if (entry.image.width !== 296 || entry.image.height !== 148) report(entry.id, 'Walker body requires four columns and two rows of 74px cells');
    if (registration.directionOrder.some((direction, index) => direction !== DIRECTIONS[index])) report(entry.id, 'Direction order must match the composer columns');
    const cells = new Set<string>();
    for (const frame of registration.frames) {
      const key = `${frame.direction}:${frame.gaitFrame}`;
      if (cells.has(key)) report(entry.id, `Duplicate walker cell ${key}`);
      cells.add(key);
      if (![frame.foot, frame.hands.left, frame.hands.right].every(point => fits(point, 74))) report(entry.id, `Socket outside 74px cell ${key}`);
      if (frame.figureHeight > frame.foot.y + 1 || frame.figureHeight > 74) report(entry.id, `Figure height exceeds cell registration ${key}`);
      if (!Number.isFinite(108 * 17.6 / frame.figureHeight)) report(entry.id, `Normalized frame geometry overflows ${key}`);
      const cloak = frame.cloakRegistration;
      if (cloak && (cloak.x < -17 || cloak.y < -17 || cloak.x + 74 * cloak.scale > 91 || cloak.y + 74 * cloak.scale > 91)) {
        report(entry.id, `Cloak exceeds padded compositor cell ${key}`);
      }
    }
    const slots = new Set<string>();
    for (const variant of registration.propVariants) {
      if (slots.has(variant.slot)) report(entry.id, `Duplicate prop slot ${variant.slot}`);
      slots.add(variant.slot);
      if (!families.has(variant.propId)) report(entry.id, `Missing prop family ${variant.propId}`);
    }
  }
  return issues;
}
