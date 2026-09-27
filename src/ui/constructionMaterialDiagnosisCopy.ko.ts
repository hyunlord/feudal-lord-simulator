// Player-facing copy of the construction material diagnosis (per-material delivery lines).
export const CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY = {
  north: "북",
  south: "남",
  west: "서",
  east: "동",
  samePosition: "같은 위치",
  directionSide: (direction: string) => `${direction}쪽`,
  lordReserve: "영주 비축",
  noSource: (prefix: string) => `${prefix} · 공급처 없음 · ETA 확인 불가`,
  noRoute: (prefix: string) => `${prefix} · 공급처까지 도로 없음 · ETA 확인 불가`,
  reserveHeld: (prefix: string) => `${prefix} · 비축분 유지 중 · ETA 확인 불가`,
  noCarrier: (prefix: string, reserved: number) => `${prefix} · 예약 ${reserved} · 배정된 운반인 없음 · ETA 확인 불가`,
  carrierPrefix: (resource: string, delivered: number, required: number, reserved: number) => `${resource} ${delivered}/${required} · 예약 ${reserved}`,
  sourceUnknown: "공급처 확인 불가",
  source: (label: string, direction: string, distance: number) => `${label} ${direction} ${distance}칸`,
  carrier: (prefix: string, source: string, carrierId: string, remaining: number, eta: string) =>
    `${prefix} · ${source} · 운반 ${carrierId} · 남은 길 ${remaining}칸 · 예상 ${eta}`,
} as const;
