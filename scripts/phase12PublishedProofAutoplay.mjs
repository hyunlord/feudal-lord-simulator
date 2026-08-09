import { proofSnapshot } from "./phase10BrowserProofCdp.mjs";
import {
  installAutoplayPulseProbe,
  observableState,
  readAutoplayPulses,
} from "./phase12PublishedProofBrowser.mjs";

const COMMIT_DEADLINE_MS = 2_000;

export async function createAutoplayObservation(client) {
  await installAutoplayPulseProbe(client);
  return {
    pulseCount: 0,
    pending: [],
    actionOrder: [],
    wrongChoices: [],
    lastSnapshot: await proofSnapshot(client),
    lastState: await observableState(client),
  };
}

export async function sampleAutoplayObservation(client, observation, atMs) {
  const snapshot = await proofSnapshot(client);
  const state = await observableState(client);
  const pulses = await readAutoplayPulses(client);
  const incoming = pulses.slice(observation.pulseCount);
  for (const pulse of incoming) {
    observation.pending.push({
      pulse,
      before: observation.lastState,
      beforeSiteIds: new Set(observation.lastSnapshot.constructionSites.map((site) => site.id)),
    });
  }
  observation.pulseCount = pulses.length;
  commitPending(observation, snapshot, state, atMs);
  recordProclamation(observation, state, atMs);
  observation.lastSnapshot = snapshot;
  observation.lastState = state;
}

export function finishAutoplayObservation(observation, atMs) {
  for (const pending of observation.pending) {
    const message = pending.pulse.message;
    observation.wrongChoices.push(
      message.includes("길")
        ? `road-to-nowhere: ${message} produced no roadRevision delta by ${Math.round(atMs)}ms`
        : `advisor pulse did not produce an observable commit: ${message}`,
    );
  }
  observation.pending.length = 0;
  const millIndex = observation.actionOrder.findIndex((action) => action.building === "mill");
  const wheatIndex = observation.actionOrder.findIndex((action) => action.building === "wheat_farm");
  if (millIndex >= 0 && (wheatIndex < 0 || millIndex < wheatIndex)) {
    observation.wrongChoices.push("mill before wheat farm");
  }
  return {
    sensible: observation.wrongChoices.length === 0,
    wrongChoices: observation.wrongChoices,
    derivedFrom: "advisorCommits",
  };
}

function commitPending(observation, snapshot, state, atMs) {
  const remaining = [];
  for (const pending of observation.pending) {
    const action = commitForPulse(pending, snapshot, state);
    if (action !== null) {
      observation.actionOrder.push(action);
      continue;
    }
    if (atMs - pending.pulse.atMs > COMMIT_DEADLINE_MS) {
      observation.wrongChoices.push(
        pending.pulse.message.includes("길")
          ? `road-to-nowhere: ${pending.pulse.message} produced no roadRevision delta`
          : `advisor pulse did not produce an observable commit: ${pending.pulse.message}`,
      );
      continue;
    }
    remaining.push(pending);
  }
  observation.pending = remaining;
}

function commitForPulse(pending, snapshot, state) {
  const pulse = pending.pulse;
  if (pulse.message.includes("길")) {
    if (!(state.roadRevision > pending.before.roadRevision)) return null;
    return {
      atMs: Math.round(pulse.atMs),
      kind: "place_road",
      label: pulse.message,
      before: pending.before,
      after: state,
      pulse,
    };
  }
  const addedSite = snapshot.constructionSites.find((site) => !pending.beforeSiteIds.has(site.id));
  if (addedSite === undefined && !(state.buildings > pending.before.buildings)) return null;
  return {
    atMs: Math.round(pulse.atMs),
    kind: "place_building",
    building: addedSite?.kind ?? buildingKindFromMessage(pulse.message),
    label: pulse.message,
    before: pending.before,
    after: state,
    pulse,
  };
}

function recordProclamation(observation, state, atMs) {
  if (state.era === null || state.era === observation.lastState.era) return;
  observation.actionOrder.push({
    atMs: Math.round(atMs),
    kind: "proclaim_era",
    label: `시대 선포: ${observation.lastState.era} -> ${state.era}`,
    before: observation.lastState,
    after: state,
    pulse: null,
  });
}

function buildingKindFromMessage(message) {
  const labels = [
    ["밀밭", "wheat_farm"], ["방앗간", "mill"], ["곡창", "granary"],
    ["벌목소", "logging_camp"], ["제재소", "sawmill"], ["오두막", "house"],
    ["우물", "well"], ["예배당", "chapel"], ["창고", "storehouse"],
  ];
  return labels.find(([label]) => message.includes(label))?.[1] ?? "unknown";
}
