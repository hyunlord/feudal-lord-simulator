export interface LabourRequest {
  buildingId: string;
  workersRequired: number;
}

export interface LabourAllocation {
  buildingId: string;
  workersAssigned: number;
}

export function allocateLabour(
  _requests: readonly LabourRequest[],
  _availableWorkers: number,
): readonly LabourAllocation[] {
  throw new Error("not implemented");
}
