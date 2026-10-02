# 원본 및 승인 경계

승인된 Wave41 29장 ZIP을 현재 다시 해시했다.

`/tmp/astra-wave41-candidates-20261002-lite.zip`

SHA256 `75aca3003432b7a73ec5971c98cde790d9a3af75ba5a385c6c12c22d1e3d4b3d`

기존 납품 기록과 일치한다. 이 작업의 출력은 별도 폴더이며 해당 ZIP 및 원본29장을 수정하지 않는다.

LAND-UI 최초 조사 시 임시 작업트리 HEAD는 caa1ea9f9c9feb2bd735aa031ff02b420361e81a였다. 다른 작업의 병합·정리로 그 임시 작업트리가 삭제되어 현재 krill(public/assets)의 동일 계열 참조를 복사해 고정했다. 복사 시점 krill HEAD: de11e5a4eb0e97a43c964e63758371f0f16af732. 자산 출처를 HEAD만으로 판정하지 않고 각 참조 SHA를 생성기록에 보존한다.

생성 도구: 내장 image_gen. 프로젝트 소유 참조만 사용. 모델명/seed는 도구에서 제공되지 않아 추측해 쓰지 않는다. 원본 생성물은 작업 폴더에 보존하고 경량 ZIP에는 최종 자산·참조·프롬프트·검수 증거를 넣는다.
