# EUIPO 상표 예비 조사

2026-10-02 KST, 공식 [EUIPO eSearch plus](https://euipo.europa.eu/eSearch/#advanced/trademarks)의 Trade marks 고급 검색 UI에서 실제 조건 조회를 완료했다. 로그인하지 않은 새 Chrome/Playwright 컨텍스트를 사용했다.

조건: Trade mark name **contains** 요청 표기, AND Nice Classification **like** 9·28·41(각각 별도), 상태·출원일·출원인 제한 없음. 기본으로 남아 있는 ApplicationNumber는 빈 값이다. 이름 완전일치만이 아니라 해당 문구 포함 조건이다. `Charter & Kin`과 `Charter and Kin`을 별도로 검색했다. 형태·음성·도형 유사검색은 수행하지 않았다.

검색 UI가 발행한 공개 검색 POST `https://euipo.europa.eu/copla/ctmsearch/json`의 요청과 응답을 셀별 JSON에 저장했다. 9셀 모두 HTTP 200, `total:0`, `items:[]`였으며 화면의 조건 요약과 No results 문구를 PNG/TXT로 보관했다.

| 검색 표기 | Nice 분류 | 결과 | 실조회 시각(KST) | 증거 |
|---|---|---|---|---|
| Charter & Kin | 9 | 해당 조건 조회 결과 0건(권리 부재 아님) | 2026-10-02T15:49:24.333334+09:00 | [eu-1-class9.json](eu-1-class9.json), [PNG](eu-1-class9.png) |
| Charter & Kin | 28 | 해당 조건 조회 결과 0건(권리 부재 아님) | 2026-10-02T15:50:37.456615+09:00 | [eu-1-class28.json](eu-1-class28.json), [PNG](eu-1-class28.png) |
| Charter & Kin | 41 | 해당 조건 조회 결과 0건(권리 부재 아님) | 2026-10-02T15:50:42.772377+09:00 | [eu-1-class41.json](eu-1-class41.json), [PNG](eu-1-class41.png) |
| Charter and Kin | 9 | 해당 조건 조회 결과 0건(권리 부재 아님) | 2026-10-02T15:50:47.992909+09:00 | [eu-2-class9.json](eu-2-class9.json), [PNG](eu-2-class9.png) |
| Charter and Kin | 28 | 해당 조건 조회 결과 0건(권리 부재 아님) | 2026-10-02T15:50:50.147757+09:00 | [eu-2-class28.json](eu-2-class28.json), [PNG](eu-2-class28.png) |
| Charter and Kin | 41 | 해당 조건 조회 결과 0건(권리 부재 아님) | 2026-10-02T15:50:52.650107+09:00 | [eu-2-class41.json](eu-2-class41.json), [PNG](eu-2-class41.png) |
| 인장과 가문 | 9 | 해당 조건 조회 결과 0건(권리 부재 아님) | 2026-10-02T15:50:54.814561+09:00 | [eu-3-class9.json](eu-3-class9.json), [PNG](eu-3-class9.png) |
| 인장과 가문 | 28 | 해당 조건 조회 결과 0건(권리 부재 아님) | 2026-10-02T15:50:57.013995+09:00 | [eu-3-class28.json](eu-3-class28.json), [PNG](eu-3-class28.png) |
| 인장과 가문 | 41 | 해당 조건 조회 결과 0건(권리 부재 아님) | 2026-10-02T15:50:59.426350+09:00 | [eu-3-class41.json](eu-3-class41.json), [PNG](eu-3-class41.png) |

유사명 등록번호·권리자·상태·상품 범위: 위 문구 포함 조건에서 결과가 없어 기재할 기록 없음. 이 결론은 위 조건에 한정된다. 개별 단어 CHARTER/KIN, 발음·철자 변형, 봉랍 인장 도형, EU 회원국의 모든 국내 등록부, 미등록 권리는 이 검색으로 조사하지 않았다. 상표 등록·사용 가능 판정이 아니다.

접근 과정: 일반 web fetch는 EUIPO 안내 페이지 403 또는 검색 본문 미렌더링이었다. 새 Chrome에서 eSearch JS UI를 렌더링해 해결했다. 별도 curl POST는 보안 오류 페이지로 302 이동했으므로 그 응답은 검색 결과로 사용하지 않았다. 성공한 9건은 브라우저 검색 UI가 직접 보낸 요청이다.

보조 재현 자료: eu-advanced.html(필드 정의), eu-browser.png(초기 화면). 대형 공개 앱 소스와 실패 경로 HTTP 헤더는 경량 패키지에서 제외하고 /tmp/charter-kin-work-20261002/research-supplement/에 보존했다. 9개 성공 요청·응답 JSON과 결과 PNG/TXT는 모두 패키지에 포함했다.
