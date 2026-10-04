# HEATH 통합 core 격리 준비 독립 검토

**PASS FOR FUTURE GUARDED TRANSFER.** cd399 격리 core16의 구체적인 병합 blocker를 찾지 못했다. 최신 main predecessor의 fresh before30과 새 transfer guard가 선행해야 하며, actual core30/시각 검토 전 runtime 수락·B/C 설치를 의미하지 않는다.

검토 대상 `/Users/rexxa/fls-astra-renderB-heath-integration`, base `cd399e4abb26fc04b37dc27b5c61bec270934a7d`. 검토자는 제품/시험/생성기/원격을 실행·수정하지 않았다. 쓰기 범위는 main의 이 보고서 하나다. `.omo/drafts/heath-main-integration-review.md`의 계획 조건과 이번 실제 diff를 대조했다.

## 실제 변경과 보존

- operations16개 모든 afterSHA를 현재 파일에 대조했다.11개 기존 tracked 수정+5개 신규. code-freeze2,345파일의 현재 SHA 모두 일치하며 이는 명시된 code/test-data 범위이지 전체 원격 제품 freeze가 아니다.
- 현재 catalog의 앞선 여섯 bundle 객체 전체가 cd399와 deep-equal. 기존102 entry와 모든 rules/순서를 보존하고 legacy `wave22-heath-patch-a` 한 entry/base rule만 append→103. 원본64×48, pivot32/40, scale.5, allowMirrorfalse를 사용한다. B/C public 파일은 실제 부재이며 이 준비는 신규아트 설치가 아니다.
- schema JSON 구조 비교 결과 `$defs.ground-prop` 외에는 전부 동일. 새 oneOf 첫 household 대안이 기존 객체 그대로이며 두 번째 land 대안은 occupations/wealth 같은 household 전용값을 허용하지 않는다. FIELD ground-texture 정의 보존, validation은 season+FIELD+land 세 검증기를 합성한다. wealth narrowing도 household에만 적용한다.
- `drawTerrainBoundaryV2.ts` diff는 `drawLandDecals(..., season)` 인수 하나뿐이다. 기존 FIELD current/next snapshots/readiness/staging 경계를 교체하지 않았다. archetype ground의 실제 요청season, archetype, baseId가 registry selection과 readiness 양쪽에 전달된다. 기존 지형 jitter/density/road·building 제외/painter traversal은 그대로이다.
- shared loader/adapters, loader시험, C25 fixture, 최신 season시험을 실제 HEAD blob과 바이트 대조해 동일함을 확인했다. 새로운 facade는 기존 createArtAdapters의 lazy 인스턴스와 image/draw를 재사용한다. late/reregister callback 및 terminal settlement 조합을 오래된 loader로 덮지 않았다.

## 소유권과 시험의 의미

`installWave22.py`는 원 source records와 archetypes에서 canonical79를 먼저 확정하고 실제 TS registry의 전체 land fallback 검증을 통과한 owned base를 제외한다. 이전 생성 manifest를 소유권의 근거로 삼지 않는다. A가 catalog로 이동해 legacy78이 되며 다른78의 내용은 유지된다. 검증은 copy/ledger mutation 전에 실행된다.

`installWave22Ownership.test.ts`는 임시 root에만 생성하며 A-only base 위에 시험용 B/C를 붙여 두 번 실행한다. generated78·owned A/B/C 바이트·A provenance/ledger 보존과 partial-season fallback의 write-before-fail 방지를 검사한다. SHA213515 최신 시험을 보존했다. 이 fixture의 B/C는 실제 B/C 설치 증거가 아니다. 생성기가 CSV 전체 바이트 보존을 일반적으로 새로 보장한다고 확대하지 않는다; 이번 core 준비에서 실제 CSV는 변경되지 않았다.

보관된 실제 focused log는 **24파일305/305, fail0/skipped0**이다. 증거 index의 파일 SHA 전부 재검증했다.304 unique title은 `type arrays distinguish null and integer for 4`가 두 번 실행되기 때문이며305와 모순되지 않는다. FIELD196 title이 전부 포함된다. HEATH 과거173의 비교는 unique172 제목을 대상으로 하며, 빠진 두 문자열은 기존65-active 기대의 retirement-compatible historical65+active 분리와 unchanged Date 입력 시험의 실행시각 문자열이다.196+173를 합산한 수치가 아니다. coverage JSON의 uncoveredBehavior=[]는 이 제목/소스 대조 범위의 결론이며 모든 runtime 행동을 입증하지 않는다.

owned22/22, typecheck/lint/diffcheck0, 실제 catalog103/103 pass는 보관된 작성자 검증 증거이다. 독립 검토에서 재시험하지 않았다. fake-image facade 시험은 readiness/fallback/geometry 오류를 검증하지만 실제 Chrome decode, equal-readiness cache 재베이크, 최종 pixel/occlusion을 대신하지 않는다.

## 미래 main 이관 관문

1. FIELD3 promotion/reference를 끝낸 실제 predecessor HEAD로 before30을 실행하고 full source/public/fixture freeze를 다시 만든다. cd399의 오래된 ledger/provenance guard를 그대로 쓰거나 main의 HEIGHT 요청 문서를 되돌리지 않는다.
2. 정확16 경로만 최신 main과 three-way 대조하고 보호102 catalog 및 loader/C25/FIELD/new9/retired6 바이트를 다시 확인한다. 새로운 코드 drift가 있으면 자동 덮어쓰기 대신 재검토한다.
3. 실제 core commit 후 같은30 state/save/camera/DPR/browser/time와 equal readiness에서 identity 및 RGBA0/A-A/errors를 검증하고 native 시각 검토를 받는다. 기존 detached30은 이번 통합 main의 증거가 아니다.
4.30은 양성/edge14+음성16이며 음성은 coastal/forest/fen/riverside×4계절이다. first-open request/decode/draw와 repeat pixel 안정성을 구분하고 저장되지 않은 repeat source absence는 주장하지 않는다.
5. B/C2 data-only, 실제data30, 독립 시각 검토/승격/reference와 최종 전체 제품 입력 geometry/publication은 모두 후속이다. 이번103 catalog나 generator 테스트의 합성 B/C로105 설치를 선언하지 않는다.

결론: 해당16바이트는 future guarded main transfer 준비로 수락 가능하다. fresh before30 및 갱신 guard가 없으면 이관하지 않으며, 아직 HEATH runtime 통과나 설치 완료라고 쓰지 않는다.
