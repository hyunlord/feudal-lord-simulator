# 경량 ZIP 문서 참조 감사

보조 검사기 `scripts/audit_archive_links.py`는 ZIP을 풀거나 수정하지 않고 안의 모든 Markdown 문서를 읽는다. Markdown 링크·이미지, backtick 안 파일명, 평문 bullet의 명시 파일명을 수집한다. 명령 예제 안 파일은 `command_file`로 구별하지만 자동 면제하지 않는다. 보고서 삽화는 문서에서 평문으로 언급해도 검사를 통과해야 한다.

실행은 Python 표준 라이브러리만 필요하다. 첫 인수 ZIP, 둘째 인수 결과 JSON이며, 선택적으로 `--allowlist` 뒤에 명시 예외 목록을 준다. 종료0은 missing/ambiguous가 모두0임을 뜻한다. 종료1이면 납품 전에 보고서를 읽고 참조를 복구·명확화해야 한다. 출력에는 문서·줄·원문·종류·상태·해결 경로·근거를 전부 남긴다.

Markdown 링크는 실제 문서 상대 경로 또는 슬래시로 시작한 ZIP 루트 경로만 허용한다. 다른 디렉터리의 같은 basename이나 gzip 대체본으로 깨진 링크를 통과시키지 않는다. 평문/backtick 파일 참조만 문서 상대 경로, ZIP 루트/도구 경로, 유일한 basename 순으로 찾는다. 여러 basename이면 document-relative가 존재할 때만 우선하며 나머지는 ambiguous로 실패한다. wildcard 파일군은 matching member를 기록하고, 숫자 구간(1..5 또는1~5)은 지정한 모든 파일이 존재할 때만 included_group으로 통과한다. 하나라도 없으면 missing이다. JSON 대신 lossless gzip만 있으면 included_compressed로 표시하며, exact 파일이 있다고 주장하지 않는다. 외부 URL은 external, 문서 내부 anchor는 internal_anchor다.

기본 source_only 예외는 게임의 `/assets/` 및 `public/assets/` 경로, 로컬에 보존한 명시 raw PNG 프레임 경로뿐이다. 주석 JPEG나 보고서 JSON 누락에 일반 면제를 적용하지 않는다. 추가 예외 입력은 pattern·reason·선택 document 세 필드의 객체 목록이며, document는 문서 경로 제한이다. 모든 예외는 결과 JSON에 기록된다. 전역 별표나 확장자 전체 면제는 거절한다. 예외를 만들 때 원본이 어디에 남는지, 왜 경량 ZIP에서 빠지는지 적어야 한다. 같은 이름을 여러 장면에서 쓰는 capture/run 등의 스키마 예시는 실제 결과 경로와 구별해 문서에 명확히 적는다.

이전 expansion ZIP에 실제 실행했으며 `OBJECT_MATCH_REVIEW.md`의 객체 대조 JPEG 네 개 누락을 모두 잡았다. 단순 예시7검증에서 평문 bullet·Markdown 링크·backtick 파일·외부 URL 추출, 존재/누락/압축파일/허용 원본 구별을 확인했다. 해당 ZIP에는 네 JPEG 외에도 초깃값 JSON·과거 보고서·실행 예시 등 추가 unresolved 참조가 있어 과거 ZIP 전체 통과로 보고하지 않았다.

`link-closure-plan.json`은 이전 ZIP unresolved151건 중 로컬 자료가 있는143건의 후보 경로와 크기를 기록한 복구 계획이다. 후보가 여럿이면 문맥 검토가 필요하다. 이 파일의 category는 포함/제외 자동 결정이 아니다. 실제 보고서·그림·정답을 참조하는 경우 포함을 우선하고, 저장소 소스·실행 입력·출력 형식 예시만 명시 예외 이유를 붙인다.

제한: 파일 존재 감사이며 내용의 의미·Markdown anchor의 실제 존재·외부 URL 연결 성공을 검증하지 않는다. 자연어의 생략 경로/쉼표 brace 약식은 정확한 경로로 고쳐야 한다. 참조가 아닌 확장자 유사 토큰이 발견될 수 있어 결과를 수동 검토한다. 아무것도 찾지 못했다는 이유로 문서 품질을 보장하지 않는다. 검사기는249 nonblank/noncomment행이며 한 책임(archive reference audit)을 유지한다. 다음 기능 추가 시 분리를 검토한다.

추가 경계 검증10개: 다른 경로의 동명 파일은 Markdown 링크 실패, 실제 상대/루트 링크 성공, 평문 유일 basename 성공, Markdown JSON 링크의 gzip 우회 실패, 두 숫자 구간 표기 각각 일부만 있으면 실패·모두 있으면 성공, 물결 구간 파일명 추출 성공. Ruff format/import/기본문법 검사 통과, Basedpyright 0 errors / 0 warnings.
