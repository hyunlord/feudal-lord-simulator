# EB-INERT 실제 대가 표시 인계

상태: 격리 규칙 시제품, 본선 채택 전. 엔진 검토 뒤 렌더 A가 화면에 연결한다. 이 요청은 UI 구현이나 화면 관문 통과를 뜻하지 않는다.

| 상황 | 기존 읽기 경로와 새 값 | 화면에서 보여야 할 것 |
| --- | --- | --- |
| 상인 관계 −100에서 특허 거절 | `oversightViews(state)[].oversight.charterResistance`: `petitionId`, `since`, `remainingSeasons`, `retryAfter` | “이 영지의 상인 거래가 위축되어 네 철 동안 거래 수입이 4분의 1 줄어듭니다.” 전체 영지 수입 또는 지대의 4분의 1로 표시하지 않는다. |
| 실제 철 결산 | `lastSummary.charterLoss.amount`, 원인 `petitionId`; 기존 `stewardship.season.params.marketLoss` | 수입 영수증에 실제 총수입 감소액. 이후 빼돌림·오류를 반영한 현금 감소액과 같다고 표시하지 않는다. 기존 흔적 줄은 이미 한국어 금액으로 출력하며 정확한 답 ID의 `decision_effect`를 연결한다. |
| 감사 묵인 | `AuditRecord.unrecovered`; 담당 청지기 `toleratedErrors[]`: `auditId`, `unrecovered`, `perSeason`, `remainingSeasons` | “미회수 금액 …”, “다음 네 철에 추가 장부 오류가 생길 수 있습니다.” 과거 손실을 이번에 또 지출했다고 표시하지 않는다. |
| 묵인 뒤 실현 오류 | `lastSummary.toleratedLosses[]`; 기존 `stewardship.season.params.toleratedError` | 이번 철 새로 잃은 금액과 각 원인 감사의 답으로 가는 흔적. 여러 감사가 겹치면 합계와 원인을 함께 표시한다. |
| 손실0·충성도100 감사 | `pendingAudits`에서 제외; 자연 생산의 기존 `stewardship.audit_clean` | 청지기 보고 한 줄. 무거운 선택 모달을 새로 열지 않는다. |

실제 수입이0이면 손실도0이다. 압력만 존재하는 상태를 “이미 돈을 잃음”으로 표시하지 않는다. 청지기가 교체되면 전임자의 압력을 후임에게 귀속하지 않는다. 같은 청지기를 재임명하면 남은 재직 철의 오류 압력이 재개된다. 숫자·기간은 정본 `stewardshipConsequencesConfig.ts`에서 읽는다. 저장 판57은 임시 번호이며 엔진이 최종 결정한다.

검증 요청: 특허 거절 전 미리보기→다음 철 손실 영수증→왜/답 이동, 감사 묵인→미회수 표시→다음 철 새 오류→다음 감사 보고를 실제 화면에서 확인. 시제품의 텍스트 단위 시험은 이 화면 수용 검사를 대신하지 않는다.
