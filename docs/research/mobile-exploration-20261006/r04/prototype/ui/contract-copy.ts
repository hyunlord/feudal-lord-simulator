const EVENTS: Readonly<Record<string, string>> = {
 offered: '교역 제안', accepted: '합의', delivered: '교환 완료', rejected: '거절',
 expired: '기한 만료', breached: '계약 위반', 'avoided-raid': '출정 보류',
};
const REASONS: Readonly<Record<string, string>> = {
 'finite goods reserved; envoy consumed': '교환할 재고를 맡기고 사절 비용을 지불했습니다.',
 'answer deadline passed': '응답 기한을 지나 맡긴 재고를 돌려받았습니다.',
 'unanswered offer released': '응답 없이 기한이 지나 맡긴 재고를 돌려받았습니다.',
 'ownership swapped exactly once; pact continues to deadline': '약속한 재고를 교환했습니다. 불가침은 기한까지 유지됩니다.',
 'planned attack withheld under paid pact': '유효한 불가침 계약으로 계획한 출정을 보류했습니다.',
 'diplomacy-disabled': '외교를 이용할 수 없습니다',
 'invalid-partner': '교역 상대를 확인할 수 없습니다',
 'envoy-capacity': '오늘 보낼 수 있는 사절을 모두 보냈습니다',
 'cargo-capacity': '운송할 수 있는 양을 넘었습니다',
 'duplicate-command': '이미 처리한 제안입니다',
 'invalid-bundle': '교환할 재고 구성이 유효하지 않습니다',
 'invalid-deadline': '계약 기한이 유효하지 않습니다',
 'pair-already-contracted': '상대와 이미 진행 중인 계약이 있습니다',
 'reservation-limit-or-inventory': '맡길 재고나 비용이 부족하거나 보관 한도를 넘었습니다',
 'not-open-offer': '응답을 기다리는 제안이 없습니다',
 'missing-city': '교역 영지를 확인할 수 없습니다',
 'offer-expired': '제안 기한이 지났습니다',
 'no-active-pact': '유효한 불가침 계약이 없습니다',
 'no-mutually-useful-trade': '양쪽 모두 이익인 교환을 찾지 못했습니다',
};
export function contractEvent(event: string): string { return EVENTS[event] ?? event; }
export function contractReason(reason: string): string {
 const known = REASONS[reason];
 if (known) return known;
 const accepted = /^recipient utility=([^;]+); shipping paid$/.exec(reason);
 if (accepted) return `상대의 예상 이익 ${accepted[1]}. 운송료를 지불했습니다.`;
 const rejected = /^utility=([^;]+); consent=(true|false); inventory and costs required$/.exec(reason);
 if (rejected) return `상대의 예상 이익 ${rejected[1]}, 수락 의사 ${rejected[2] === 'true' ? '있음' : '없음'}. 이익·재고·비용 조건을 모두 충족해야 합니다.`;
 const breached = /^(player|neighbor) forfeited bond (\d+), paid (\d+), reputation -4$/.exec(reason);
 if (breached) return `${breached[1] === 'player' ? '우리 영지' : '이웃 영지'}가 보증금 ${breached[2]}과 배상금 ${breached[3]}을 지급하고 평판 4를 잃었습니다.`;
 return reason;
}
export function sessionMessage(message: string): string {
 let translated = contractReason(message);
 for (const [key, value] of Object.entries(REASONS)) translated = translated.replace(`(${key})`, `(${value})`);
 return translated.replace(/계약 응답: ([a-z-]+)\./, (_, event: string) => `계약 응답: ${contractEvent(event)}.`);
}
