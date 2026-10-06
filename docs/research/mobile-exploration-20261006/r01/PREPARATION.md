# 준비 문서와 저장소 상태

2026-10-06 확인. 전용 작업 폴더 /Users/rexxa/fls-astra-mobile. 본 저장소 코드 수정·커밋·푸시 및 DGX 사용 없음.

클론 시작 커밋 eeccc92a6c3c67b82859d325492b8166f1e6a3be. 지정 가지 codex/phase15-organic-ground. Git LFS 다운로드가 아직 진행 중이므로 클론 완료·깨끗한 체크아웃 검증은 후속 단계에 남긴다. 원격 가지는 조사 중 843e52d18c0cadb272d9f54544788db723ee13dc로 이동했으며 읽기 전용 fetch로 추가 확인 중이다.

읽은 문서:
- 시작 커밋의 docs/design/foundation.md
- 시작 커밋의 docs/design/lord-mode.md
- 시작 커밋의 docs/design/trades-and-force.md
- /Users/rexxa/Downloads/GAME_PRINCIPLES_v0_2.md
- /Users/rexxa/Downloads/EXTENSIBILITY_v1_1.md

시작 커밋의 트리에는 docs/design/game-principles.md와 docs/design/extensibility.md가 없었다. Downloads의 두 문서를 읽었으나 저장소 정본과 동일하다고 간주하지 않는다. 원격 갱신본을 확인해 차이를 기록한 뒤 R02 원칙 표와 R03 재사용 판단을 확정한다.

읽기에서 확인한 핵심 제약:
- 직접 건설 대신 조건을 바꾸고, 가구가 이유 점수로 선택한다.
- 같은 규칙·결정론·보이는 이유가 우선이다. 수치와 색만 다른 클래스는 충족하지 못한다.
- 본편은 전술·정복 전쟁을 범위 밖으로 둔다. 모바일 전쟁은 별도 제품의 명시적 차이여야 한다.
- 확장성 문서는 목표 구조와 현재 구현의 간극을 명시한다. 모바일 팩을 넣기만 하면 작동한다고 주장할 수 없다.

## 후속 확인: 문서 공백 해소
원격 fetch가 성공했다. 커밋 843e52d18c0cadb272d9f54544788db723ee13dc에는 두 지정 문서가 존재한다. git show로 별도 records에 추출하여 Downloads 원본과 전체 diff를 대조했다. 게임 원칙은 제목·정본 승인 문구만, 확장성은 제목·승인 문구·EXT-D1~D3 판정 문단만 추가되었다. 본문 규칙의 차이는 없다. 추가된 승인 문구까지 읽었으며 두 문서는 더 이상 미확인 항목이 아니다. 원본 체크아웃의 LFS 완료는 별개다.
