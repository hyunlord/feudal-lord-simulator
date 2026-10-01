# 3~14회차 발견 종결 감사

기존 회차의 README·FINDINGS·REGRESSION만 읽은 문서 감사다. 추가 게임 관찰·제품 코드 조회·수정은 하지 않았다. **33개 ID: OPEN 24 · NOT_REPRODUCED 3 · UNVERIFIED 1 · CLOSED 4 · CANDIDATE 1**. 49개 검토 기준과 고유 발견 ID 수는 다르다.

`CLOSED`는 명시된 기존 재현 범위를 직접 확인한 종결이며 코드 수정 원인까지 입증했다는 뜻이 아니다. 단순 최신 미재현은 종결 근거가 아니다. 과거 양성이 남고 같은 조건의 해소 검증이 없으면 `OPEN`을 유지한다. `NOT_REPRODUCED`는 관측 실패, `UNVERIFIED`는 필요한 식별/조건 부족, `CANDIDATE`는 규칙·원인 미확정이다.

| ID | 최종 누적 상태 | 근거 회차 | 판단 및 증거 |
|---|---|---|---|
| QA001 | NOT_REPRODUCED | 3→14 | 3회차 원본 재검토에서 줄기 단절 의심 철회.14회차 정지/1/3/5× 표본도 미재현. 결함 수정의 인과를 입증한 CLOSED가 아니며 모든 수종·장시간 자연스러움은 미검증. [회귀표 3](history/03-REGRESSION.md) · [회귀표 14](history/14-REGRESSION.md) |
| QA002 | UNVERIFIED | 3→14 | 이동·머묾은 확인했으나 집 앞 개체 ID/역할 및 정지 이유를 확보하지 못했다. 일부 운반인 이동으로 전체 주민 문제를 닫지 않음. [회귀표 14](history/14-REGRESSION.md) |
| QA003 | OPEN | 14 | 320000틱·줌2·(45,42) 완공19/19 목책000041 seg000에서 시각적 단절. 통행 오류로 단정 안 함. [사진](evidence/14-wall14-exact003.jpg) |
| QA004 | NOT_REPRODUCED | 3→14 | 14회차 실제 자동 발전 ON309.701초 표본에서 반복 길 미재현. 정적 사진 사이 모든 명령을 확인한 검사가 아니며 수정 완료 아님. [회귀표 14](history/14-REGRESSION.md) |
| QA005 | OPEN | 14 |  선택 Roger carter000048, 1×80프레임 중19–22에서 성벽 위 겹침 외형. 경로 침범 원인 미확인. [사진](evidence/14-wall14-roger80-detail.jpg) · [GIF](evidence/14-wall14-roger80.gif) · [전체 펼침](evidence/14-wall14-roger80-unfolded.jpg) |
| QA006 | CLOSED | 3·4 명시적 지정 재현 통과;14 제한 확인 | 범위 한정 종결: 기본 회색 장부 틀→양피지 계열 및 장부 하단 접근은3·4회차 직접 비교·조작으로 닫음.14회차 단순 미재현으로 새 종결한 것이 아님.9·10회차 UI-01 실패는029 접근 실패와 중복이라고 문서에 명시되어006 미술 결함 재열림으로 중복 집계하지 않는다. 모든 UI 틀/폭이 정상이라는 뜻은 아님. [회귀표 3](history/03-REGRESSION.md) · [회귀표 4](history/04-REGRESSION.md) · [회귀표 9](history/09-REGRESSION.md) · [회귀표 14](history/14-REGRESSION.md) |
| QA007 | NOT_REPRODUCED | 3→14 | 물 위 벽 횡단·별도 물가 단절은 표본에서 입증되지 않음.003의 시각적 틈과 분리하며 고침으로 표시하지 않음. [회귀표 14](history/14-REGRESSION.md) |
| QA008 | CLOSED | 3·4 지정 줌 재현 통과;14 제한 확인 | 범위 한정 종결:3회차0.508/0.559/0.565/0.615/1.199 왕복,4회차0.5/1.181/2에서 손그림 유지의 명시적 통과/닫힘을 인정. 모든 LOD 경계·작은 주민 판독은 미검증;027 영주관 도형을008 추가 결함으로 중복 집계하지 않는다. [회귀표 3](history/03-REGRESSION.md) · [회귀표 4](history/04-REGRESSION.md) · [회귀표 14](history/14-REGRESSION.md) |
| QA009 | CLOSED | 3·4 지정 사건 재현 통과;14 제한 미재현 | 범위 한정 종결:3회차1384과세·1394길드·1396교회 각2선택/1349임금,4회차 자치·길드·교회에서 빈 줄 대신 실제 수치를 읽고 명시적으로 닫음.14회차 과세/길드/교회 수치도 확인. 모든 사건·선택지 개수·장기 경제 정확성 보장은 아니며030 현재값 불일치와 별개. [회귀표 3](history/03-REGRESSION.md) · [회귀표 4](history/04-REGRESSION.md) · [회귀표 14](history/14-REGRESSION.md) |
| QA010 | OPEN | 14 | 1394봄376151틱 길드 청원에 ‘젊은 토머스 밀러82살’. 구원본 유래 이름이며 신규 명명 검사는 아님. [사진](evidence/14-ui14-064-guild1600.jpg) |
| QA011 | CLOSED | 3~14 동일 사건 쌍 반복 확인 | 동일1394 길드 대립/1396 교회 증축 장면을 실제 정상 진행해 구별했다. 이 정확한 쌍의 종결만 인정하며 다른 사건의 공용 삽화 후보는 남는다. [14 길드](evidence/14-ui14-064-guild1600.jpg) · [14 교회](evidence/14-ui14-067-church1396.jpg) · [회귀표 5](history/05-REGRESSION.md) |
| QA012 | OPEN | 13 양성;14 제한 확인 | 13회차 큰 대각 지면 경계 재현이 남아 있다.14회차 수관 전체 점프 미관측·밭/눈 인접 표본 전환은 동일 실패를 통제 재현해 없어진 증거가 아니므로 닫지 않음. [13 GIF](evidence/13-root13-firstwinter-build100.gif) · [13 펼침](evidence/13-root13-firstwinter-build100-unfolded.jpg) · [회귀표 14](history/14-REGRESSION.md) |
| QA013 | OPEN | 3 닫음→4 재열림;14 제한 확인 | 4~9회차375 목표/사건 클릭 가림으로 재열림.14회차 임금/달력에서 읽기·닫기가 된 것은 다른 조건의 한정 반례이며 원래 대기근 가림의 전체 해소 아님. [9 원래 기준 후속](history/09-REGRESSION.md) · [14 임금](evidence/14-root14-044-goal-chips375.jpg) · [회귀표 4](history/04-REGRESSION.md) · [회귀표 14](history/14-REGRESSION.md) |
| QA014 | OPEN | 14 | 국왕 실제 카드·전기의 king 영문 역할 표기. [사진](evidence/14-ui14-026-king-card.jpg) · [사진](evidence/14-ui14-027-king-bio.jpg) |
| QA015 | OPEN | 14 | 새 게임 토머스/앨리스 및 국왕 전기의 빈 기록 문구와 중앙 장식선 겹침. [사진](evidence/14-ui14-009-thomas-biography.jpg) · [사진](evidence/14-ui14-027-king-bio.jpg) |
| QA016 | OPEN | 14 | 1394 길드1600/1280에서 보류 버튼이 둘째 선택지 우하단 테두리와 겹침. [사진](evidence/14-ui14-064-guild1600.jpg) |
| QA017 | OPEN | 14 | 375 생업 상단분류 창밖, 위휠1800 후 동일. [사진](evidence/14-ui14-043-build375.jpg) · [사진](evidence/14-ui14-044-build375-up.jpg) |
| QA018 | OPEN | 14 | 1280×720 상단설정의 튜토리얼 설명·화면소리 겹침.005 Esc메뉴 정상 표본과 분리. [사진](evidence/14-ui14-004-settings1280.jpg) · [사진](evidence/14-ui14-005-esc1280.jpg) |
| QA019 | OPEN | 14 | 1600 상단설정 버튼 오른쪽 잘림. [사진](evidence/14-ui14-003-settings1600.jpg) |
| QA020 | OPEN | 13 양성;14 다른 표본 | 13회차 가계도 두 줄 이름 하단 잘림.14회차 말줄임표는 동일 증상 재현이 아니며 과거 양성 해소 미검증. [사진](evidence/13-ui13-019-successor-tree.jpg) |
| QA021 | OPEN | 14 | 실제 시장000044(56,35) 상세의 기본 닫기칸 빈 기호.037파일명 house는 선택 건물과 다름. [사진](evidence/14-ui14-037-house1600.jpg) |
| QA022 | OPEN | 14 | 1300겨울3120틱 정지·줌2·pan544,-2277에서 첫 겨울 더보기 클릭 후 본문 한 문장은 같고 버튼만 사라짐. 실제 휠 후에도 동일. [전](evidence/14-ui14-087-winter-before.jpg) · [후](evidence/14-ui14-088-winter-after.jpg) · [휠](evidence/14-ui14-089-winter-wheel.jpg) · [GIF](evidence/14-ui14-winter-motion.gif) · [전체 펼침](evidence/14-ui14-winter-motion-unfold.jpg) |
| QA023 | OPEN | 14 | 375 과세사절칩이 시장 제목·닫기하단 덮음. 클릭불능까지 단정 안 함. [사진](evidence/14-ui14-038-market375.jpg) |
| QA024 | OPEN | 14 | 375닫기 x406.078,y486,w55.922,h44 전체창밖,가로휠1500 미복구/Escape복구. Tab/Enter 미검증. [사진](evidence/14-ui14-046-person375.jpg) · [사진](evidence/14-ui14-047-person375-horizontal.jpg) |
| QA025 | OPEN | 14 | 정지356431틱에서 목표 보기 클릭 후 소개 없이356482틱1× 진행. [사진](evidence/14-ui14-053-goal-before.jpg) · [사진](evidence/14-ui14-054-goal-after.jpg) · [GIF](evidence/14-ui14-goal-motion.gif) · [전체 펼침](evidence/14-ui14-goal-motion-unfold.jpg) |
| QA026 | OPEN | 14 | John carter000081 선택 후1×80프레임 중 첫32에서 이동하지만 같은 다리 벌림 외형 반복. 동물은 정지 표본뿐이어서 보행 미검증. [사진](evidence/14-wall14-john-click.jpg) · [GIF](evidence/14-wall14-john80.gif) · [전체 펼침](evidence/14-wall14-john80-unfolded.jpg) |
| QA027 | OPEN | 14 | 321333틱·(29,17) 영주관 실제 선택·줌2에서 갈색 평면 지붕/회색 벽 도형. 최초 잘못된 카메라의 manor2/1/05는 제외. [사진](evidence/14-wall14-manor-selected2.jpg) |
| QA028 | OPEN | 13 기록 존재 양성;14 빈 기록 제한 확인 | 13회차 실제 기록이 있는데22px 빈 띠로 비표시, 재열기도 동일.14회차 기록 없는 표본의 제한 확인으로 양성을 덮지 않음. [13 재열기](evidence/13-ui13-037-population-reopen.jpg) · [회귀표 13](history/13-REGRESSION.md) · [회귀표 14](history/14-REGRESSION.md) |
| QA029 | OPEN | 14 | 375 연대기 가로/세로 휠 후 왼쪽 목록·오른쪽닫기 창밖. Escape 복구. [사진](evidence/14-ui14-015-record375.jpg) · [사진](evidence/14-ui14-016-record375-scroll.jpg) |
| QA030 | OPEN | 14 | 1340 통제160783 정지 저장의 식량208일→수동 재로드 직후204일(인구480·금고3636 동일).1364 통제값은 일치. 원래 인구 불일치의 원인과 같다고 단정하지 않음. [사진](evidence/14-control14-004-saved.jpg) · [사진](evidence/14-control14-005-manual-immediate.jpg) |
| QA031 | OPEN | 14 | 문제보기1600/375 세계강조는 있으나 범례 비표시. [사진](evidence/14-ui14-041-problem1600.jpg) · [사진](evidence/14-ui14-042-problem375.jpg) |
| QA032 | OPEN | 14 | 1340 실제3장 시작·83틱 진행·정지 저장 후 재로드4초/24초에2장 결산.1322 무입력100프레임도0–3세계→4부터1장 결산.1364동일 절차 음성 표본 보존. [사진](evidence/14-control14-006-manual4s.jpg) · [GIF](evidence/14-control14-1322-immediate100.gif) · [전체 펼침](evidence/14-control14-1322-immediate100-unfolded.jpg) · [통제 원문](history/14-control14-observation.md) |
| QA033 | CANDIDATE | 13→14 | 정지90255틱 주택(43,43)의 ‘시장 멂—거리4/범위8’와 시장의 ‘길40걸음’ 관계 설명 후보. 다른 단위·도로 조건·실제 대상이어서 엔진 계산 오류는 미확인. [14 같은 집](evidence/14-root14-008-service-market-church.jpg) · [회귀표 14](history/14-REGRESSION.md) |

## 종결·중복 판단 주의

- **001은 수정 완료로 세지 않는다.**3회차의 지정 관찰 닫음 표현은 원본 의심 철회였으므로 누적 상태를 미재현으로 정규화했다.002는 여전히 역할/동일인 식별 부족이다.
- **006·008·009·011만 지정 범위 CLOSED**다.006은 지정 장부,008은 지정 줌 왕복,009는 명시된 사건 선택지,011은 길드/교회 동일 쌍이다.14회차 한정 반례만으로 닫은 항목은 없다. 다른 기준의 UI 접근 실패029, 영주관 도형027, 재정/식량 표시030을 각각 별도 ID로 유지한다.
- **012·013·028은 최신 한정 음성/미검증에도 OPEN**이다.13회차 HEAD26507989와14회차267b43b8의 변경 내용은 이 감사에서 조사하지 않았으며 변경 존재만으로 수정 완료를 추정하지 않는다.
- **033은 후보**이며 OPEN 확정 결함 수에 합산하지 않는다. 다른 무번호 계보·지면·결산 후보는 각 회차49기준 표에 보존되어 이33ID 표 밖이다.
- 14회차 README의 진행 중 문구는 중단 직전 문서 상태다. 이번 사용자 중단 지시 후 새 관찰을 수행한 것으로 읽지 않는다.
