# 근거와 판정 범위

확인일: 2026-10-02. 코드 근거는 `codex/phase15-organic-ground`의 `5a15e62d4f36f37f36cf7ef854b3677337482d61`에 고정한다. 온라인 문서는 아래의 확인 범위만 사용했다. 직접 열기가 403으로 막힌 자료는 검색 도구가 반환한 해당 기관 페이지의 색인 본문으로 확인했으며, 원문 전체를 열었다고 주장하지 않는다.

| ID | 출처 | 이번 감사에서 사용한 내용 | 접근·한계 |
| --- | --- | --- | --- |
| H01 | [The National Archives, Currency converter](https://www.nationalarchives.gov.uk/currency/) | 파운드·실링·페니의 전통 화폐 체계. 정확한 게임 환산은 money.ko.ts의 12d=1s, 20s=£1과 대조 | 검색 본문. 현대 구매력 환산은 사용하지 않음 |
| H02 | [The National Archives, Plague / Statute of Labourers](https://www.nationalarchives.gov.uk/explore-the-collection/explore-by-time-period/early-modern/plague/) | C 74/1, 1351년 법령과 이를 앞선 1349년 조례를 구별 | 기관 색인 본문. 국왕의 현장 낭독을 뒷받침하는 기록으로 사용하지 않음 |
| H03 | [The National Archives, E179 grant 403](https://www.nationalarchives.gov.uk/e179/notes.asp?action=3&slctgrantid=403) | 1377년 인두세의 4d·연령 조건과 징수 설명 | 기관 색인 본문. 연령 경계의 현대적 번역 차이를 별도 결함으로 세지 않음 |
| H04 | [The National Archives, E179 grant 407](https://www.nationalarchives.gov.uk/e179/notes.asp?action=3&slctgrantid=407) | 1380년 승인·1381년 징수와 15세 초과 조건. 세 차례 세금의 조건이 모두 같지 않음 | 기관 색인 본문. 게임의 징수 수입 1d·3d를 사료 수치로 인정하지 않음 |
| H05 | [The Calais Mint and the Staple, 1363–1404](https://numismatics.org.uk/wp-content/uploads/2022/05/Spufford-Medieval-Europe.pdf) | 1390년 이전안 미실행, 1391년 11월~1392년 5월 칼레 스테이플 중단을 구분 | 학술 PDF의 검색 색인 문단 확인. 동시기 모든 직물 가격이 상승했다는 근거로 쓰지 않음 |
| H06 | [Lancaster University, Cumbrian Manorial Records Glossary](https://www.lancaster.ac.uk/fass/projects/manorialrecords/glossary/index.htm) | steward·bailiff·reeve·demesne·heriot·entry fine 등 개념 구분 | 원문 열람. 북부 지역 특유의 관행을 남부 전체의 동일 제도로 일반화하지 않음 |
| H07 | [The National Archives, Taxation before 1689](https://www.nationalarchives.gov.uk/help-with-your-research/research-guides/taxation-before-1689/) / [S. A. Morgan, The History of Parliamentary Taxation in England](https://www.gutenberg.org/cache/epub/53189/pg53189-images.html) | 1334년 이후 fifteenths and tenths의 지역 단위 납부와 고정액 체계. 영주 개인의 현재 금고 10%와 구별 | 기관 안내와 역사 연구서의 색인 본문 대조. 현대 법률·세무 조언이 아님 |
| H08 | [The Royal Family, Edward II](https://www.royal.uk/edward-ii) / [Richard II](https://www.royal.uk/richard-ii) / [Henry V](https://www.royal.uk/henry-v?page=1) / [Henry VI](https://www.royal.uk/henry-vi) | 해당 군주의 재위 범위, 헨리 6세의 영아 즉위 | 공식 인물 페이지의 색인 본문. 모든 생일·전투 세부를 외부에서 전수 대조했다는 뜻은 아님 |

## 저장소 기준

- `AGENTS.md`: 특히 34행의 달력 도착점·틱/게임초 금지. 이번 의뢰의 읽기 전용 제한이 그래프 생성·코드 수정 등 일반 작업 절차보다 우선한다.
- `docs/design/lord-mode.md`: 권리와 약속, 권원과 점유, 청지기 위임, 직할 장원과 이웃 영지 구별.
- `docs/design/art-bible.md`: 13행의 재료 공존 원칙, 1300년 기본형과 1450년까지의 후기 예외, 시대 금지 목록. 이미지 자체의 고증 검수는 이번 문구 감사 범위 밖이다.
- `docs/research/`의 조사 문서 6개: 콘텐츠 목록, UI 상태 설계, 젠트리 영지, 간접 통치, 영주의 무력, 시장도시 생업. 관련 정의·시대 조건을 비교했다. 연구 초안에 실린 출처 표식을 검증된 원문 인용으로 재사용하지 않았다.

## 오류와 의도적 설정을 나누는 기준

가공의 영지·귀족 가문·주교좌는 `src/content/gentryNames.ts`가 명시한 의도적 설정이다. 실재하지 않는다는 이유로 오류를 만들지 않았다. 왕과 세계 사건은 역사적 인물·사건이므로 별도로 취급했다. 세금·생산·승계의 간소화는 엔진 변경 요구가 아니라, 문구에서 게임 규칙임을 밝히는 제안으로 분류했다. 현대 한국어 인터페이스 단어 자체를 시대착오로 판정하지 않았다.

청지기와 집행관, 영지와 장원, 가구와 가문은 서로 다른 개념이다. 실제 충돌 근거 없이 동의어로 합치지 않았다. 흑사병·역병, 양털·양모·모직도 맥락에 따른 구분을 유지한다. 기존 화폐 요약 표기의 절삭 의도는 인정하되 납부 결정 화면에는 정확한 금액을 권장한다.
