# LM-E1 자율 성장 1차 — 보고서

관문: __GATE__

- **담당**: Claude Code, 엔진 세션.
- **브랜치**: `claude/lme1-town-agency`.
- **지시서**: `to_ClaudeCode_FIX11_LME1.zip`의 `CLAUDE_CODE_WORK_ORDER_LME1.md`(6시간). 근거는 [영주 모드 설계서](../../design/lord-mode.md) 3.1·5·6절이다.
- **명세**: [자율 성장](../../design/town-agency.md) TA-1~TA-9.
- **결정**: LM1-1~LM1-9.
- **시험**: `tests/townAgency.test.ts`(10).
- **판**: `scripts/lordModeRun.ts`(영주 모드 한 판), `scripts/lordModeCompare.ts`(비교표).

## 만든 것

1. **행위자**: 가구·상인 가문·길드·공동체·교회. 각자 자금을 갖고 주마다 저축한다. 필요 70점 이상 사업은 공동체에서 빌린다.
2. **사업 제안**(주마다, 78틱)
   - 봇의 계획 함수를 필요로 읽는다(`planningNeeds`: 우선순위 목록 전부, 봇 파일은 그대로).
   - 장려금·방침이 미는 기회 사업을 더한다.
3. **이유 점수**: need·policy·subsidy·dues·stuck(FIX-11 `stuckStock`)·access·risk·relation·cost. 항목별로 저장한다.
4. **착수와 영수증**
   - 플레이어 명령과 같은 엔진 단계로 착수한다.
   - 영수증과 원장 `agency.project_started`를 남긴다(이유 상위 5, 관련 영주 결정 id). `whyHere(state, buildingId|siteId)`로 읽는다.
5. **영주 조건 셋**: 영지 방침, 사업 장려금(금고에서 지급), 시장 부담. 모두 원장 결정이고, 영수증이 그 id를 가리킨다.
6. **모드**: 새 게임 `mode: "lord" | "sandbox"`, 기본 샌드박스. 영주 모드는 일반 건물 배치를 닫는다. 캠페인 기본값은 그대로다.
7. **영주 모드 봇**: 영주 역할만 한다(조건, 청원·기근 답, 도시의 요청 허락).
8. **저장 v36**: `agency`(선택).

## 관문 ① 봇 없이 자라는가

__GROW__

## 관문 ② 조건이 도시 모양을 바꾸는가(핵심)

__COMPARE__

## 관문 ③ 영수증 대조

__AUDIT__

## 가드레일(샌드박스·캠페인 불변)

__GUARDRAIL__

## 필수 조건

__REQUIRED__

## 거쳐 온 길

- **첫 판**: 강가 seed 1이 1302년 집 19채에서 멈췄다.
  - 1306년에는 봇의 계획도 아무것도 내지 않았다.
  - 원인: 상인이 시장이 없어 수입 0, 자금 120d로 제재소(240d)를 못 지었다. 목재 사슬이 서지 않았다.
  - 상인의 운송 거래 수입과 공동체 대출을 넣자 1313년 24채 모두 L2가 됐다.
- **방침이 모양을 바꾸지 못함**: 첫 비교 판에서 "세입 + 방앗간 장려금"과 "성장 + 방앗간 장려금"이 한 푼까지 같았다.
  - 필요(58~100점)는 방침과 상관없이 다 지어졌고, 기회(방침만으로 30점 안팎)는 문턱 40에 못 미쳤다.
  - 기회 사업이 방침 가중치를 두 번 세게 했다(LM1-4).
- **대조 불일치**: 첫 대조에서 불일치가 26~47 %였다. 모두 길 영수증의 0점짜리 비용 항목(반올림 −0)과, 대조가 길의 비용을 다시 세지 않은 것이었다. 0점 항목을 빼고 길의 비용은 영수증의 d로 읽게 했다.
- **요청 캐시**: 재 보니 이득이 없어 뺐다(LM1-7).

## 렌더 세션이 넘겨받을 것(LM-R1)

- `whyHere(state, id)`: 건물·공사장을 누르면 영수증을 보인다. 영수증에는 행위자, 무엇, 필요 단계, 이유 상위 5(이름·값), 점수, 비용·장려금·대출, 관련 영주 결정 id가 있다.
- 영주 조건 명령과 상태
  - `set_estate_policy {policy}`, `set_project_subsidy {kind, amount}`, `set_market_dues {permille}`
  - `state.agency.policy / subsidies / duesPermille`, 행위자 자금 `state.agency.actors`
- 영주 모드의 공공사업 후보: `LORD_PUBLIC_WORKS`(지금 `keep`).
- 도시의 요청(`lordRequests(state)`: 시대 선포·성벽 우선·상인 목재)은 영주가 허락할 카드로 보인다. 헤드리스 판에서는 영주 봇이 허락한다.
- 새 게임 화면의 `mode` 선택, 영주 모드에서 건설 서랍을 명령 핀으로 줄이기.
- 문구: 원장 `decision.estate_policy`·`decision.project_subsidy`·`decision.market_dues`·`agency.project_started`(`historyCopy.ko.ts`).

## 다음 후보

__NEXT__

## 소요 시간

__TIME__
