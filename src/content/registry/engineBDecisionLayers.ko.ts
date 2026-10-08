import type { DecisionWeight } from '../stewardPolicyConfig';

export type EngineBDecisionLayer = DecisionWeight;

export type EngineBDecisionWeight =
  | { readonly weight: 'lord'; readonly layer: EngineBDecisionLayer; readonly reason: string }
  | { readonly weight: 'steward'; readonly layer: null; readonly reason: string };

/** Editorial scope labels; runtime command exceptions are declared separately below. */
export const ENGINE_B_DECISION_LAYERS: Readonly<Record<string, EngineBDecisionWeight>> = {
  ck_evt_041: { weight: 'steward', layer: null, reason: '당해 방목료 10~30d 징수·면제이며 숲 이용권 자체의 신설·이전이 아니다.' },
  ck_evt_048: { weight: 'steward', layer: null, reason: '기존 공유 목초지 청원의 승인·거절과 두 세력의 관계만 정한다. 실제 가축 상한·공유권·토지 권원은 바꾸지 않는다.' },
  ck_evt_050: { weight: 'steward', layer: null, reason: '사업 제안의 성장·안정·수입 우선순위 변경이며 교구 토지·권리를 바꾸지 않는다.' },
  ck_evt_056: { weight: 'steward', layer: null, reason: '기존 도로 청원의 일회 분담금과 관계를 정하는 운영 처리다. 실제 도로 파손·수선 완공이나 통행권 이전을 뜻하지 않는다.' },
  ck_evt_057: { weight: 'lord', layer: 'rights', reason: '만료 없는 시장 특허와 권리 좌판세 배율을 상인에게 부여할지 결정한다.' },
  ck_evt_058: { weight: 'steward', layer: null, reason: '50d 일회 합의금 유무와 상인 호응을 정하며 새 권리·영구세·채무 면제는 없다.' },
  ck_evt_061: { weight: 'lord', layer: 'rights', reason: '감독 방식과 권리·혼인 청원의 상신 범위를 바꾸는 행정권한 위임 결정이다. 재산권 이전을 뜻하지 않는다.' },
  ck_evt_062: { weight: 'steward', layer: null, reason: '목재 조달이나 제재·벌목 사업에 24~32d를 지원하는 생산 운영 선택이다.' },
  ck_evt_065: { weight: 'steward', layer: null, reason: '농장·곡창 40d 지원 또는 수입 우선 방침이며 토지 취득·양도나 확정 공사가 아니다.' },
  ck_evt_067: { weight: 'lord', layer: 'land', reason: '실제 후보의 영지 감독권을 임명·회수하는 행정권한 결정이다. 청지기의 자기 임명이 아니며 재산권 이전도 아니다.' },
  ck_evt_068: { weight: 'steward', layer: null, reason: '철회 가능한 농장 공고를 0·16d로 조정하거나 안정 방침을 택하며 고정된 여러 해 계약은 없다.' },
  ck_evt_075: { weight: 'lord', layer: 'rights', reason: '실제 열린 토지 소송에서 점유·증서·칙허 중 권원 주장을 뒷받침할 증거를 선택한다.' },
  ck_evt_076: { weight: 'lord', layer: 'land', reason: '감사 배분 외에 특정 후보에게 영지 감독을 위임하는 선택이 있어 행정권한 결정으로 분류한다. 재산권 이전은 아니다.' },
  ck_evt_077: { weight: 'lord', layer: 'rights', reason: '권리·혼인 청원의 상신 범위 자체를 정하는 행정권한 위임 결정이다. 개별 권리 부여나 혼인 판결은 아니다.' },
  ck_evt_078: { weight: 'lord', layer: 'land', reason: '상인·농민 친화 후보 중 감독권자를 임명하거나 직접 회수한다. 지대·시장 부담은 행정위임의 결과이며 재산권 이전은 아니다.' },
  ck_evt_080: { weight: 'steward', layer: null, reason: '미집행 목재 주문을 0·8·16단위로 조정하는 후속 구매 운영이다.' },
  ck_evt_083: { weight: 'steward', layer: null, reason: '목재 구매·시장 32d 지원·일반 좌판 부담 조정이며 시장 특허나 새 권리를 부여하지 않는다.' },
  ck_evt_085: { weight: 'steward', layer: null, reason: '제분·우물 사업지원 32d를 배분한다. 물 공급 소재만으로 실제 위기 결정을 뜻하지 않는다.' },
  ck_evt_087: { weight: 'steward', layer: null, reason: '일반 좌판 부담·시장 24d 지원·성장 방침을 조정하며 새 권리나 세력 결렬을 만들지 않는다.' },
  ck_evt_088: { weight: 'steward', layer: null, reason: '맥아·제분 사업지원 총 24d를 배분하는 생산 운영 방침이다.' },
  ck_evt_090: { weight: 'steward', layer: null, reason: '목재 6~12단위 주문과 제재소 12~24d 지원이며 특정 점포 수선·재산권 이동을 결정하지 않는다.' },
  ck_evt_092: { weight: 'steward', layer: null, reason: '일반 시장 부담과 성장 우선순위 변경이며 영구 특허 양보가 아니다.' },
  ck_evt_093: { weight: 'steward', layer: null, reason: '시장 전체 부담이나 20d 사업지원을 정하며 새 장인만의 특권·면세권을 만들지 않는다.' },
  ck_evt_095: { weight: 'steward', layer: null, reason: '시장 공고 철회·축소 또는 창고 24d 지원이며 확정 채무·여러 해 계약을 파기하지 않는다.' },
  ck_evt_100: { weight: 'steward', layer: null, reason: '창고·시장 32d 지원 또는 목재 16단위 조달로 물류 기반의 운영 지원을 배분한다.' },
  ck_evt_147: { weight: 'lord', layer: 'land', reason: '사망한 관리 뒤 실제 후보에게 감독권을 위임하거나 직접 맡는다. 행정권한 임명이며 가문 상속·재산권 이전이 아니다.' },
  ck_evt_170: { weight: 'steward', layer: null, reason: '곡창·창고 32d 지원이나 목재 주문 취소이며 일손 부족 자체로 위기 등급을 만들지 않는다.' },
} as const;

/** Per-command exceptions only. Null removes a static weight; measured sums and rupture still apply. */
export const ENGINE_B_COMMAND_WEIGHT_OVERRIDES: Readonly<Record<string, Readonly<Record<string, DecisionWeight | null>>>> = {
  ck_evt_057: { petition_response: 'rights' },
  ck_evt_058: { petition_response: null },
  ck_evt_061: { set_exception_rules: 'rights' },
  ck_evt_077: { set_exception_rules: 'rights' },
};
