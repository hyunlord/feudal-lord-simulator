export function makePhase13FailureEvidence(config, error, partial = {}) {
  return {
    schemaVersion: 1,
    verdict: "FAIL",
    publicUrl: config.publicUrl,
    revision: config.revision,
    deploymentProof: config.deploymentProof ?? null,
    onlineVerification: partial.onlineVerification ?? null,
    loadedResources: partial.loadedResources ?? [],
    screenshots: partial.screenshots ?? [],
    pageInteractions: partial.pageInteractions ?? [],
    responsive: partial.responsive ?? [],
    construction: partial.construction ?? [],
    frameProfile: partial.frameProfile ?? null,
    errors: partial.errors ?? { console: [], page: [], resource: [], network: [], log: [], runtime: [] },
    failure: {
      name: error instanceof Error ? error.name : "Error",
      message: bounded(error instanceof Error ? error.message : String(error)),
    },
  };
}

function bounded(value) {
  return value.length > 1_000 ? `${value.slice(0, 1_000)}...<truncated>` : value;
}
