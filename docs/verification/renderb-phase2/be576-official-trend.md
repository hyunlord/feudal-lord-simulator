# Phase 2 공식 커밋 추이

**완료 — remote/fetch exit0.** `infra-TREND-be576dbe-be576db`, 정확 `be576dbee826fc9e02a0336bb98cae4209fa5279`. 공식 heavy/detach/keep 단회 실행, 기본 own HEAD 측정·장면별3회×45초·자동 A/B 확인을 보존했다.

- big-town-x5 / new-game-x3 각3회 성공, 코드 예산6개 모두3회 측정 중앙값이 한도 이내.
- 비교는 실제 이전 측정 조상90d9b586. 큰 도시 GC 위, 새 게임 할당 아래·GC 위라는 최초 의심을 남겼다. 두 장면 각각4쌍 A/B의 JS 할당 MB/s·GC/분·캔버스 생성/초·GC 뒤 힙 네 지표는 모두 95% t 범위에서 **소음 안**. 나빠짐이 없어 두번째 A/B는 요구되지 않았다.
- 동기화18.9초, 준비6.9초, 슬롯대기0초, 명령1,288.6초. 실제 원격 전후guard에서 tracked26,844/export26,848/LFS6,384·exactHEAD·clean·전체SHA가 유지됐다.
- 원본 측정/두 A/B JSON, run/trend log, timing의 경로·바이트·SHA를 짝 JSON에 기록했다.

DGX 헤드리스·소프트웨어 래스터 결과이며 일반 기기의 프레임 성능으로 확대하지 않는다. 제품·공식 추이 문서 갱신·추가 원격 작업·재실행 없음. 게시 증명은 부모 소유이며 이 영수증은 추이 측정만 증명한다.
