# R06 누적 콘텐츠 — 200개 미설치 초안

R05의 사건200개와 편집답변24개를 승계했다. R06에서는40건의 등록기 지원 설명과3사건·4자료의 근거20필드를 교정했다. 선택·효과·본문·조건·등록기는 바꾸지 않았다. ASTRA_ANSWERS_R05.json의 외부 상대경로 근거 ANSWERS.json을 R06 records/lm-e9-answers/에 바이트 동일 복사했다. R05 편집 과정 자료는 records/editorial-resolutions-r05-inherited/에 보존했다.

아래 R03/R05 문단은 작성 이력이다. ../records/CONTENT_PROMOTION_R02 및 기타 과거 경로는 당시 납품 ZIP에서 읽으며, R06 새 검증이나 설치 증거가 아니다. 초기 R06 참조 검사는 ../records/CONTENT_R06_REFERENCE_CHECK.json에 있다. 이후 특정 사료081/189/195의 접근·편년 범위를 재검토한 적용 기록은 ../records/source-hold-application-r06/이다. 전체 원전 재검증이나200편 엔진 등록 실행을 한 것은 아니다.

# R03 누적 콘텐츠 납품본 — 작성본 승계

R01 canonical을 복사해061 b/c의 반복 재상신 업무 문구,143/153의 논점 밖 c 제거만 적용했다. 200편·572선택·395명령 템플릿, 모든 enabledInEngine=false. 197편은 정규 JSON 동일하며 originals/는 바이트 보존했다.

[EVENTS.md](EVENTS.md)는 현재 원고에서 생성한 전문, [KNOWN_DEBT.md](KNOWN_DEBT.md)는 기존 차단 부록이다. engine지원표는 c8cb7b7d 소스 검토를 유지하며 이번 HEAD5fb1aebf에서 관련 엔진 코드 차이가 없다. 조건adapter·등록기·런타임 통과나 게임 설치를 뜻하지 않는다.

revisions/r02-cost-diversity/before/는 R01 변경 전 파일이다. PROVENANCE의 이전 외부 records 링크는 R01 원본을 기준으로 해석한다. PROMOTION.md는 R01의 과거 승격 기록이다. 현재 승계 근거는 ../records/CONTENT_PROMOTION_R02.md이며, 그 기록의 200편·572선택을 기준으로 삼는다.

## R03 설명 정정

R02 승격 기록은 ../records/CONTENT_PROMOTION_R02.md/json에 복사했다. 이번 변경은 README의 납품 상태 설명뿐이다. 사건/등록기/문장 JSON은 R02와 바이트 동일하며, 설치·엔진 연결·자연UI 통과를 뜻하지 않는다. 이전 README는 ../records/r03-documentation-before/에 보존했다. R01 외부 경로를 가리키는 과거 기록은 당시 ZIP 근거이며 현재 R03 내부 파일로 오인하지 않는다.

## R03 후속 정정: 홈 선례 설명

위의 R02 바이트 동일 설명은 후속 정정 전 상태다. 현행 소스를 다시 확인해 events.json의 recurrence.steward 45곳에서 오래된 홈 선례 미구현 설명을 수정했다. 홈 12종의 제한된 ER-6 처리와 누적 200편 일반 위임을 구분한다. 선택·효과·ID·registry.json은 변경하지 않았다. 변경 전 원본과 필드별 차이는 revisions/r03-precedent-scope/에 보존했다. 이 수정은 정적 설명 정정이며 런타임 검증이 아니다.

## R05 최종 편집 갱신

현재 원고·등록조건은 R05 네 질문 개정판이며 ASTRA_ANSWERS_R05.json에24답변을 모았다. EDITORIAL_CONTRACTS_R05.json·PETITION_DEFS_DRAFT_R05.json은 미구현 selector/lifecycle 계약이다. 이전 ENGINE_EFFECTS/READ_MODEL 등의 전체 재검증을 주장하지 않는다. 011 새 비교명세와 시장 존재 조건은 sidecar를 함께 읽고 실행차단을 유지해야 한다. 현재 검증범위는 VALIDATION.json에 분리했다.
