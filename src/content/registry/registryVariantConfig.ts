/** ER-13: canonical integration.classificationNote links; names translate bindings, never choice IDs. */
export type RegistryVariantLink = {
  readonly variantEntryId: string;
  readonly bindings: Readonly<Record<string, string>>;
};
const shared = { estate: 'estate', currentSteward: 'currentSteward', currentPerson: 'currentPerson', estateOversight: 'oversight' } as const;
const ability = { variantEntryId: 'ck_evt_067', bindings: { ...shared, able: 'ableCandidate', loyal: 'loyalCandidate' } } as const;
export const REGISTRY_VARIANT_LINKS: Readonly<Record<string, RegistryVariantLink>> = {
  ck_evt_031: ability,
  ck_evt_059: ability,
  ck_evt_019: { variantEntryId: 'ck_evt_078', bindings: { ...shared, merchant: 'merchantCandidate', peasant: 'peasantCandidate' } },
};

export const HOME_PETITION_VARIANTS: Readonly<Record<string, string>> = {
  pannage: 'ck_evt_041', common_pasture: 'ck_evt_048', road_bridge: 'ck_evt_056',
};
