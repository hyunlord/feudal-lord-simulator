# UI-6b 국왕 문장·결정 카드 원형 틀·세력 쪽 기록 칸·습격 부두·피란민 문구 — 보고서

관문: 통과 — 스킨 감사 0 / 909(26개 상태) · 면적 1280 평소 5.9 % / 6 % · 튜토리얼 22 = 22 · B9·TOUCH 14/14 · 터치 대상·글자 위반 0 · DGX 전체 회귀 3,272/3,272 · 병합 전 검사 · 클론(아래 6절)

## 1. 국왕 문장(연도 분기)
- `factionEmblem(faction, year)`에서 국왕(`kind: "crown"`)만 시드 대신 왕실 문장(`{ kind: "royal", arms }`)이다. `royalArms(year)`: 1340년 전 `england`, 1340년부터 `france_england`.
  - england: 붉은 바탕에 금사자 셋을 세로로(in pale).
  - france_england: 4분할 — 1·4분면 파랑 바탕 금백합 흩뿌림(France ancient), 2·3분면 잉글랜드 사자 셋.
- 조합: Wave 14 `charge_lion_passant`·`charge_fleur_de_lis`를 `shield_heater` 위에, 분면은 `partition_quarterly` 알파(1·4분면), 질감은 다른 문장과 같다. 배치는 `ROYAL_LAYOUT`(`heraldry.ts`). 문장 합성의 픽셀 계산은 한 함수(`paintArms`)로 나눴고, 기존 문장은 같은 계산 그대로다.
- 연도: 세력 탭·세력 쪽·청원 카드는 지금 해, 연대기의 관계 기록 카드는 그 기록의 해.
- 사자 얼굴은 Wave 14 passant(옆모습) 그대로 병합했다(사용자 판정). guardant 사자로 된 완성 채색 두 판은 Astra Wave 23에 요청돼 있고, 도착하면 국왕 분기만 그 그림으로 바꾼다.
- [royal-arms.jpg](royal-arms.jpg)(왼쪽 1340년 전, 오른쪽 1340년부터) · [f1](captures/f1-faction-tab.jpg) · [f2](captures/f2-faction-page.jpg) · [w02](captures/w02-wool_payment-2-ui.jpg)(1337, 잉글랜드).

## 2. 결정 카드 왼쪽 위 원형 틀
- Wave 8 청원 틀의 원(모서리 조각의 중심 원본 68, 110 → 화면 34, 55 px)에 보낸 세력의 문장 38 px. "보낸 이" 줄의 작은 문장은 뺐다(왕실 칙서의 밀랍 인장은 그대로). [w08](captures/w08-refugee_admission-2-ui.jpg)

## 3. 세력 쪽 아래 칸
- 칸 테두리가 Wave 19 그림에 그려져 있어, 그림을 가로 띠 다섯으로 나눠 그린다(`FACTION_PAGE_BANDS`): 두 칸의 곧은 옆선(원본 380–520)은 70 px로, 아래 칸의 곧은 옆선(610–730)은 190 px로. 모서리 장식은 늘이지 않고, 쪽 높이 800은 그대로.
- 요구·약속 칸 172 → 102 px, 우리와의 일·그들의 연표 148 → 218 px. 기록 링크가 세 개 보인다. [f2](captures/f2-faction-page.jpg)

## 4. 습격 부두
- Wave 12 `quay-v1`(확정)을 설치했다(`scripts/installWave17World.py`, `public/assets/wave12/world/quay-v1.png`, 출처 장부 한 줄, 설치 대장 `installed_by` = UI-6b). 칸(256×128)과 바닥 기준점(68, 119)이 부두 불과 같아, 같은 칸에서 불보다 먼저 그린다. [w07](captures/w07-raid-1-world.jpg)

## 5. 피란민 청원
- "보낸 이: 윈캐스터 주교 (피란민을 대신해)"(`PETITION_COPY.onBehalf`).

## 6. 검증
- 로컬: typecheck, lint, 관련 시험 32(새 시험 둘 — 국왕 문장 연도 분기, 원형 틀·피란민 문구 — 과 부두 위치 검사).
- DGX 전체 회귀 `f65a338`: 3,272/3,272.
- DGX UI 관문 `f65a338`, 본선 `41c38ca2` 대비([gates.json](gates/gates.json)): 면적 1280 5.9 % / 6 %, 태블릿 6.4 % / 8 %, 튜토리얼 22 = 22, B9·TOUCH 14/14, 게임패드·초점 복귀, 터치 대상·글자 위반 0. 캡처 16단계 오류 0.
- 스킨 감사: 첫 실행에서 대기근 결정 상태가 빠졌다 — 기본 지연 1.5 초에 결정 카드가 `openScene`의 첫 Esc 전에 열려 닫혔고, 대신 누른 칩이 "젖은 여름"이었다(불러오기 속도에 따라 본선은 통과). 청원·대기근 단계의 이야기 지연을 5 초로 하고 감사만 `b77dd03`에서 다시 돌려 0 / 909, 26개 상태 모두([audit.json](audit/audit.json)). 그 실행의 본선 감사는 장 끝 단계에서 멈췄다(첫 실행 본선 0 / 788 통과). `gates/exit-codes.txt`의 감사 1은 첫 실행 값이다.
- 깨끗한 클론: 아래에 적는다.
- 증거 0.5 MB.

## 7. 결정
UI6B-D1~D3([결정 목록](../../decisions/README.md)).
