import type { ResourceType } from '../content/resourceConfig';
import { resourceName } from "../content/resourceCatalog.ko";

export const CONSTRUCTION_DEADLOCK_COPY = {
  shortLabel: '비축 교착',
  action: '공사 우선으로 전환',
  site: '🪵 비축 교착 · 창고 가득',
  cause: (resource: ResourceType, used: number, capacity: number): string =>
    `비축분 때문에 공사가 멈춤 · 목재 생산이 막힘(창고 가득 참 ${used}/${capacity} · 가장 많은 재고 ${resourceName(resource)}) → 공사 우선으로 바꾸거나 창고를 늘리세요`,
  grouped: (count: number, label: string): string => `공사 ${count}구간이 같은 이유로 대기: ${label}`,
} as const;
