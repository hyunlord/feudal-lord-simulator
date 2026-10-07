import type { ArtBundle, ArtInsets } from './artContract';
import type { ArtSchemaIssue } from './schemaValidation';

/** Screen parts (LM-R2): slices and safe insets leave a real centre; derivatives are the same picture at another width. */
export function validateUiParts(bundles: readonly ArtBundle[]): readonly ArtSchemaIssue[] {
  const issues: ArtSchemaIssue[] = [];
  const entries = bundles.flatMap(bundle => bundle.entries);
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const leavesCentre = (insets: ArtInsets, size: { readonly width: number; readonly height: number }): boolean =>
    insets.left + insets.right < size.width && insets.top + insets.bottom < size.height;
  for (const entry of entries) {
    const path = `$/entries/${entry.id}`;
    if (entry.kind === 'ui-frame') {
      if (!leavesCentre(entry.slice, entry.image)) issues.push({ path, message: 'Frame slices leave no centre' });
      if (!leavesCentre(entry.contentInset, entry.image)) issues.push({ path, message: 'Frame content inset leaves no content area' });
    }
    if (entry.kind !== 'ui-image') continue;
    const widths = new Set<number>();
    for (const derivative of entry.derivatives) {
      const asset = byId.get(derivative.assetId);
      if (asset?.kind !== 'ui-image' || asset.image.width !== derivative.width
        || asset.image.width * entry.image.height !== entry.image.width * asset.image.height) issues.push({ path, message: `Invalid UI image derivative ${derivative.assetId}` });
      if (widths.has(derivative.width)) issues.push({ path, message: 'Duplicate UI image derivative width' });
      widths.add(derivative.width);
    }
  }
  return issues;
}
