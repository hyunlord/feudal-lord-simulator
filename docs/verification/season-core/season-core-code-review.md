# Detached season core 코드 검토

판정: **최초 세 결함은 작업 중 수정됐고 마지막 소스 재대조에서 해소 확인. 남은 코드 차단 결함 없음; 고정 SHA 및 runtime 승인은 별도.**. 기준 `a40cf05e`, 대상 `/Users/rexxa/fls-astra-renderB-season-prep`의 작업 중 diff. 검토 도중 executor가 파일을 갱신했으므로 최종 고정 SHA 승인으로 읽지 않는다. 제품 수정/테스트/무거운 작업은 수행하지 않았다. Graft navigation 뒤 실제 소스를 대조했다.

## 최초 발견과 동시 수정 재확인

### 해소 확인 (최초 P2) — legacy45에도 terminal raster 실패 정책이 적용됨

`src/render/seasonArt.ts:129–136`은 모든 key에 `rasterState=failed`를 저장하고 이후 무조건 null을 반환한다. 기존 코드는 `rasterizeWorldSprite`가 null을 반환하거나 Error를 던지면 다음 조회에서 재시도했다. 현재 branch는 migrated20뿐 아니라 legacy 과수 `orchard_apple_d_spring`, `orchard_tree_spring` 등에도 이 동작을 바꾼다. finalcorrections의 “Migrated image-ready와 raster-ready … terminal fallback” 및 legacy45 보존 범위를 넘는다. 일시적인 canvas/context 실패가 legacy 과수의 영구 base fallback으로 바뀐다.

최소 수정: terminal state는 `SEASON_VARIANT_IDS.has(key)`인 migrated 경로에 제한하고 legacy null/throw retry 정책을 유지한다. 또는 legacy 실패정책까지 바꾸려는 별도 범위 결정을 명시해야 하지만 현재 계획에는 없다. 기존 legacy key를 사용해 첫 raster 실패→두 번째 성공 fixture를 추가하고 migrated는 반복 호출1회 정책을 유지한다.

### 해소 확인 (최초 P2) — callback이 Error 이외 값을 던지면 나머지 소비자의 ready 알림이 중단됨

`src/render/art/artImageLoader.ts:27–30`의 catch는 `!(error instanceof Error)`일 때 다시 throw한다. JS callback은 문자열/객체/null도 throw할 수 있다. ready 전에 등록한 첫 callback이 문자열을 던지면 notify loop가 중단되어 후속 callback을 호출하지 않고, decode.then 성공 handler의 반환 promise는 void로 버려져 unhandled rejection이 된다. 이미 ready인 상태에서 등록하면 onReady 자체가 throw한다. decode 성공 이미지 상태는 ready지만 다른 소비자는 raster를 준비하지 못한다. “한 소비자의 callback failure가 다른 소비자를 막지 않는다”는 분리 계약을 Error 객체만으로 제한할 이유가 없다.

최소 수정: unknown throwable 전부를 consumer error로 정규화/기록하고 알림 loop를 계속한다. Error 및 primitive throw 각각에서 두 번째 소비자1회, image ready 유지, unhandled rejection 없음이 필요하다.

### 해소 확인 (최초 P2) — contract ID가 legacy season ID와 충돌하면 조용히 다른 metadata로 덮임

`src/render/seasonArtManifest.generated.ts` 마지막 줄은 `{ ...SEASON_VARIANT_IMAGES, ...LEGACY_SEASON_IMAGES }`이며 legacy가 우선한다. `seasonVariantValidation.ts`는 registry 내부 ID/기하만 검사하고 legacy key 충돌은 검사하지 않는다. 예를 들어 유효한 tree_oak_large spring entry/rule의 asset ID를 `grass_autumn_fill`로 쓰면 registry 내부에서는 유일하고 base/geometry도 유효해 startup 검사를 통과한다. 그러나 union에는 기존 grass metadata가 남고 `SEASON_VARIANT_IDS`에는 그 ID가 있어 preload는 contract tree 이미지 요청과 legacy grass metadata를 섞는다. registry가 선택한 entry와 facade metadata가 달라져 기존 소비자까지 깨질 수 있다.

최소 수정: legacy와 migrated ID 집합이 disjoint인지 **union 노출 전에** 검사하고 충돌이면 명시적으로 거부한다. spread 순서만 뒤집으면 legacy ground 소비자가 가려지므로 해결이 아니다. 순수 merge helper/분리된 legacy 데이터로 검증해 import cycle을 만들지 않는다. 실제 catalog20은 충돌하지 않지만 startup 검증을 거친 데이터-only 추가를 안전하게 받는 계약에는 이 거부가 필요하다.

## 마지막 소스 재대조

최초 발견을 부모에게 전달한 뒤 executor의 동시 수정이 들어왔다. `seasonArt.ts`에서 legacy raster null/Error는 unprepared로 유지하고 migrated만 failed로 남긴다. `artImageLoader.ts`는 unknown throwable을 Error로 정규화하고 알림을 계속한다. `seasonVariantArt.ts`의 새 `mergeSeasonImages`는 legacy/contract ID 충돌을 throw한 뒤 합집합을 freeze하며 generated manifest:51에서 실제 호출된다. 따라서 위 세 항목은 **현재 열린 결함 목록이 아니라 수정 이력**이다. 수정 후 tests는 본 검토에서 재실행하지 않았다.

## 확인된 구현 연결 및 미완료 증거 구분

- `createArtRegistry`는 schema 다음 `validateRegistryData`를 실행하고, 여기서 `validateSeasonVariants`가 실제 world/zone registration을 대조한다. issues가 있으면 snapshot/registry 노출 전에 throw하므로 base 검증이 선언만 된 상태는 아니다.
- 11번째 kind의 adapter 분기는 image-substitution descriptor이며 기존10 분기는 유지된다. visual-architecture의10종 표는 제안이고 finalcorrections가 후속 문서 추가를 명시했다. 문서 미반영 자체를 이 detached 코드의 차단 결함으로 세지 않았다.
- preload는 활성 key union을 sort한 뒤 소유 loader에 dispatch하므로 core65의 interleaved 순서를 보존하는 구현이다. generator는 `seasonMigrationOwnership.json`의 base/season을 읽어 legacy45를 생성하므로 활성 oldspring6 제거 뒤에도 이전20이 재출현하지 않는다.
- abs/trunc→safe integer, winter_snow→winter, lexical unit-weight 규칙, fullcanvas/base pivot/scale 검사는 계획과 일치한다. crop 재발명·engine 성장 사실 추가는 확인하지 못했다.
- `c25Board.ts`는 broad SeasonKey에 `seasonMeta`를 사용하도록 경계를 바꿨으며 stand-in 치수/label의 의미는 유지한다.
- 실제 배포/브라우저의 같은 readiness 이후 A/A·A/B zero RGBA, transition·DPR·줌·가림, 전체 suite/build는 이 read-only 검토에서 실행하지 않았다. focused241 보고는 그 증명을 대체하지 않는다. 작업 중 새 fixture/data가 보여 고정 core/data-only diff 경계도 executor의 최종 산출물에서 다시 확인해야 한다.
- callback listener 보관은 현재 facade가 startup당 asset별1개만 등록하므로 현재 소비자에서 무한 증가 경로는 확인하지 못했다. 공통 API의 반복 구독 가능성만으로 현재 누수라고 판정하지 않았다.

변경 파일은 이 검토 문서 하나. Graft 보고 절감11,854 tokens.
