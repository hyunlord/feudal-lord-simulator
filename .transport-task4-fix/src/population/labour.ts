export interface LabourRequest {
  buildingId: string;
  workersRequired: number;
}

export interface LabourAllocation {
  buildingId: string;
  workersAssigned: number;
}

export function allocateLabour(
  requests: readonly LabourRequest[],
  availableWorkers: number,
): readonly LabourAllocation[] {
  let remainingWorkers = Math.max(0, Math.floor(availableWorkers));

  return requests.map((request) => {
    const assigned = Math.min(Math.max(0, request.workersRequired), remainingWorkers);
    remainingWorkers -= assigned;
    return {
      buildingId: request.buildingId,
      workersAssigned: assigned,
    };
  });
}
