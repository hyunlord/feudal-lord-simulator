# UK IPO 상표 예비 조사

조사일: 2026-10-02 KST. 공식 안내 https://www.gov.uk/search-for-trademark 에서 연결된 키워드 검색 https://trademarks.ipo.gov.uk/ipo-tmtext/start 를 사용하려 했으나 검색어 입력 전 Security check/CAPTCHA 화면으로 막혔다. HTTP 200 본문도 등록부가 아니라 보안 검사였다.

| 표기 | Nice 9 | Nice 28 | Nice 41 |
|---|---|---|---|
| Charter & Kin | 확인 못 함 | 확인 못 함 | 확인 못 함 |
| Charter and Kin | 확인 못 함 | 확인 못 함 | 확인 못 함 |
| 인장과 가문 | 확인 못 함 | 확인 못 함 | 확인 못 함 |

검색어/분류를 등록부에 제출하지 못했으므로 0건으로 표시하지 않는다. 유사 상표의 등록번호·권리자·상태·지정상품도 확인 못 함. 일반 검색엔진 검색으로 공식 등록부 결과를 대체하지 않았다.

회복 시도: omo:ultimate-browsing Tier 1 engine을 실행했다. 14 attempt를 기록했으나 curl_cffi 없음, Playwright MCP 없음, playwright-extra 없음으로 실패했다. Tier 2 CloakBrowser와 agent-browser도 설치되어 있지 않았다. 새 의존성 설치·로그인·CAPTCHA 수동 해결·유료 조회는 하지 않았다.

증거: uk-entry.html, uk-security-check.txt, uk-engine.json, uk-engine-stderr.txt. 공식 등록부 미조회는 권리 부재나 사용 가능성을 뜻하지 않는다.

추가 회복 확인: 2026-10-02T15:54:02.431452+09:00에 EUIPO 조회에 성공한 동일 native Playwright + 설치된 Chrome의 새 비로그인 컨텍스트로 공식 start URL을 실제 탐색했다. 최종 URL `https://trademarks.ipo.gov.uk/ipo-tmtext/start`, HTTP 403, 화면에는 동일한 Security check 문구가 표시되었고 검색어·분류 입력란은 나타나지 않았다. CAPTCHA 풀이·클릭·우회는 하지 않았다. 추가 증거: uk-chrome.png(실제 화면), uk-chrome.txt(본문), uk-chrome-meta.json(시각·최종 URL·상태). 따라서 9셀 모두 확인 못 함을 유지한다.
