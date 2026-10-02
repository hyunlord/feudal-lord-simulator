/**
 * LM-E9 (ER-10): content drafts v2's new events (docs/design/content-drafts-20261002/v2/events.json) as registry entries.
 * Only drafts whose conditions read unambiguously as the registry's read model are here; the rest are listed in
 * docs/verification/lm-e9/AMBIGUOUS.md for the content session (the user's decision 2026-10-03).
 */
import type { RegistryEntry } from "./registryTypes";

export const DRAFT_EVENT_ENTRIES: readonly RegistryEntry[] = [];
