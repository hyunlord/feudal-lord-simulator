# ASSET-2 관문 ① 재실행

ASSET-1 방법 스크립트(`../../asset-audit/method/`)를 이 작업 가지 체크아웃에 대고 `hashall.py` → `reconcile.py`를 다시 돌린 뒤, `gate.py`가 그 결과(`hashes.json`·`reconcile.json`)에서 네 수를 센다.

- 장부·대장 어디에도 없음(`장부 밖 — 설치 대장에도 없음`)
- 옛 버전 등록(`confirmed 옛 버전`)
- runtime의 caBX 청크
- runtime 안 같은 이름·다른 픽셀

`gate.json`이 이 가지의 결과다(네 목록 모두 비어 있다). 기준 본선 `a33390d9`에서는 10 · 7 · 6 · 4였다.
