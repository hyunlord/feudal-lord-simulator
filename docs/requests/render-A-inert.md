# EB-INERT 실제 대가 표시 인계

상태: 격리 규칙 시제품, 본선 채택 전. 최신 감사 묵인은 아래 상시 방침 계약을 따른다. 기존 청지기·장부 화면의 최소 연결도 시제품에 포함하며 브라우저 검증 결과는 별도 기록한다.

| 상황 | 기존 읽기 경로와 새 값 | 화면에서 보여야 할 것 |
| --- | --- | --- |
| 상인 관계 −100에서 특허 거절 | `oversightViews(state)[].oversight.charterResistance`: `petitionId`, `since`, `remainingSeasons`, `retryAfter` | “이 영지의 상인 거래가 위축되어 네 철 동안 거래 수입이 4분의 1 줄어듭니다.” 전체 영지 수입 또는 지대의 4분의 1로 표시하지 않는다. |
| 실제 철 결산 | `lastSummary.charterLoss.amount`, 원인 `petitionId`; 기존 `stewardship.season.params.marketLoss` | 수입 영수증에 실제 총수입 감소액. 이후 빼돌림·오류를 반영한 현금 감소액과 같다고 표시하지 않는다. 기존 흔적 줄은 이미 한국어 금액으로 출력하며 정확한 답 ID의 `decision_effect`를 연결한다. |
| 감사 묵인 | `AuditRecord.unrecovered`; 담당 청지기 `toleratedErrors[]`: `auditId`, `unrecovered`, `perSeason`, `remainingSeasons` | “미회수 금액 …”, “다음 네 철에 추가 장부 오류가 생길 수 있습니다.” 과거 손실을 이번에 또 지출했다고 표시하지 않는다. |
| 묵인 뒤 실현 오류 | `lastSummary.toleratedLosses[]`; 기존 `stewardship.season.params.toleratedError` | 이번 철 새로 잃은 금액과 각 원인 감사의 답으로 가는 흔적. 여러 감사가 겹치면 합계와 원인을 함께 표시한다. |
| 손실0·충성도100 감사 | `pendingAudits`에서 제외; 자연 생산의 기존 `stewardship.audit_clean` | 청지기 보고 한 줄. 무거운 선택 모달을 새로 열지 않는다. |

실제 수입이0이면 손실도0이다. 압력만 존재하는 상태를 “이미 돈을 잃음”으로 표시하지 않는다. 청지기가 교체되면 전임자의 압력을 후임에게 귀속하지 않는다. 같은 청지기를 재임명하면 남은 재직 철의 오류 압력이 재개된다. 숫자·기간은 정본 `stewardshipConsequencesConfig.ts`에서 읽는다. 저장 판57은 임시 번호이며 엔진이 최종 결정한다.

검증 요청: 특허 거절 전 미리보기→다음 철 손실 영수증→왜/답 이동, 감사 묵인→미회수 표시→다음 철 새 오류→다음 감사 보고를 실제 화면에서 확인. 시제품의 텍스트 단위 시험은 이 화면 수용 검사를 대신하지 않는다.

## 상시 방침으로 바뀐 감사 묵인

위 표의 유한 네 철 압력은 구형 저장 호환 설명이다. 새 명시적 묵인은 `standingPolicies(state)`의 영지 묶음에 `auditTolerance` 항목을 만든다. 읽기는 `estateId/personId/perSeason/baselineLoss/baselineLoyalty/active`; `allowedSettings`는 활성일 때 `['lord']`, 철회 뒤 `[]`다. 설정키 `audit:<estateId>:<personId>`의 `set_standing_policy`로 언제든 거둔다. 재활성화는 새 감사의 명시적 답만 가능하다.

`stewardReport(state, from, to).toleratedLosses`와 `.audits`는 실제 해당 철의 손실과 자동 감사다. 장부의 `audit_tolerance_loss`는 음수 현금 항목이며 원인 감사 claim을 가진다. 총 입금과 이 손실을 합친 값이 실제 순입금이므로 이중 차감하지 않는다. 기존 청지기 보고·상시 방침 패널·영지별 금고 화면에 같은 값/원인을 연결했다.

`answerEffects(state, answerId)`의 감독 방식 변경은 답 시점 값이며 후속 계절 현금은 최초 영수증을 변조하지 않고 정확한 답 ID의 결과 흔적으로 연결한다. `undefined`는 기록 부재, `[]`는 변화 없음이다. 전임자 방침은 후임자나 재임명 때 자동 재개하지 않는다.
