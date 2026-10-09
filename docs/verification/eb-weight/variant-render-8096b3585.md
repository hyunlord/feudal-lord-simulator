# Engine B · 변주 화면 증거 재검토

검토 기준: 본선 `8096b35858d9f52b148eaa0073dd6e7812f78ed3`, B 통합 `716b2e0427bfbcda081f12724cb6753aa456caa9`. 새 브라우저 실행 없이 본선의 JPEG12장 전부를 직접 읽고 자동 판정과 대조했다.

## 확인한 범위

- 041·048·056·067·078의 제목·본문이 각각 데스크톱/태블릿 카드에 보인다.041·067 칩 캡처도 같은 변주 문구를 보여 준다.
- 홈 청원6장과 칩2장은 캡처에서 제목·본문·선택/행동 버튼을 읽을 수 있다. 전체 자연 노출이나 응답 뒤 결과 연결의 증명은 아니다.
- 등록기067·078의 데스크톱/태블릿4장은 하단 `나중에 정한다` 버튼이 잘렸다. 데스크톱은 위 테두리만, 태블릿은 글자 일부만 보인다. 두 주요 선택 버튼과 변주 제목·본문은 보인다.
- `scripts/variantCaptures.mjs:49–54,82`의 판정은 root 외곽·문구·최소 글자 크기·선택 수다. 하단 버튼의 실제 노출/가림/포인터 도달을 측정하지 않으므로 기존12/12는 이 발견과 양립한다.
- 067 데스크톱은 같은 스크립트87행의 Playwright `click()` 뒤 칩 캡처가 생성됐다. 자동 스크롤이 포함될 수 있으므로 최초 화면의 완전 가시성이나 사람이 스크롤 없이 누를 수 있음으로 해석하지 않는다.078 및 태블릿의 수동 스크롤/키보드 도달은 이 정적 검토에서 확인하지 않았다.

렌더 인계: 최초 위치 또는 명확한 스크롤 경로에서 하단 보류 버튼의 완전 가시성과 실제 포인터/키보드 동작을 재확인한다. B는 렌더 CSS·관문 기준을 변경하지 않는다. 현재61개 요청행의 통합 기하 검사는 별도 진행 중이며, 그 결과로 이 픽셀 관찰을 덮어쓰지 않는다.

독립 읽기 전용 검토도 같은4장에 REVISE를 반환했고 원본8096b3585와 현재 파일 바이트 일치를 확인했다. 이 판정은 픽셀 가독성 범위이며 상호작용 실행은 추가하지 않았다.

## 원본 이미지 해시

| 파일 | SHA-256 |
|---|---|
| [home-041-1280x800.jpg](../variants/home-041-1280x800.jpg) | `032d87bff340cf2286beda62c189400a0b55331c4f4dcaecfff743f13ced447a` |
| [home-041-chip.jpg](../variants/home-041-chip.jpg) | `66749d405981f387cba43298fa831b5e0679c00bad97a3dcd3811797436aad94` |
| [home-041-tablet.jpg](../variants/home-041-tablet.jpg) | `1d64ee930b7628d9775c1aa15643aa6153272460a598391d7bd9c214cb52a41c` |
| [home-048-1280x800.jpg](../variants/home-048-1280x800.jpg) | `5a9967631ea4f09433f04d328261fb40985b41c715e7eb12b9bf6d99028ed09d` |
| [home-048-tablet.jpg](../variants/home-048-tablet.jpg) | `44af690bc8c48a7be9f44fa9898b03c00b2c87a3d0091a761a12af1ae230bf6a` |
| [home-056-1280x800.jpg](../variants/home-056-1280x800.jpg) | `80c59c62222d212f3d8d6ca6340ee7d4fcf4534baefec09892d610a31a9cfb27` |
| [home-056-tablet.jpg](../variants/home-056-tablet.jpg) | `739e261125af717730407dc94bd89a3411d9fbe20b4ad87a197a72ad1dcd3e6f` |
| [registry-067-1280x800.jpg](../variants/registry-067-1280x800.jpg) | `7518815857a6e5810603e602111db90a9b6405f564814fd16d2b072bffcfeadc` |
| [registry-067-chip.jpg](../variants/registry-067-chip.jpg) | `5425937f3aebb938f38334a5a90cf36105ab688050e81e85fde367408d5b1f0f` |
| [registry-067-tablet.jpg](../variants/registry-067-tablet.jpg) | `a43c636e365e6bfb286765c8657bb39272990542d3548089f3f7f396da1d5d13` |
| [registry-078-1280x800.jpg](../variants/registry-078-1280x800.jpg) | `7fc090110d194fcd8fb727394f1f15b68a9a72c184ecc146e0c32add8dbb2dd5` |
| [registry-078-tablet.jpg](../variants/registry-078-tablet.jpg) | `18d4b2a3039a3739c7c53aab99528698c346077a454a1a24da4d7e53cbd5b790` |
