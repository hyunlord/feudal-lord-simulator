# 재현과 납품 검사

## 결과만 다시 계산

ZIP을 빈 디렉터리에 풀고 기존Python환경 또는 제공된도구의 lockfile환경을 사용한다. 다음 명령은 검출 재실행 없이 포함된 후보·사전정답으로 동일 점수를 재계산한다. 경로는 ZIP 루트 기준이다.

```sh
cd tools/vision-check
uv sync
uv run python -m vision_check.cli benchmark ../../report/holdout/evaluation/frozen-results/findings.json ../../report/holdout/truth-combined.json /tmp/holdout-rescore --human-rejections ../../report/holdout/semantic-rejections.json
```

출력은 평가JSON·전체대응JSON·Markdown표다. 정밀도/재현율분모0은null로 보존한다. 검출 위치는 후보JSON의원본픽셀 box이며 축소JPEG의화면좌표로 직접대체하면안된다.

## 원본 장면 수집·검출 재실행

게임원본과node_modules/브라우저실행환경은 이ZIP에 포함하지 않는다. 별도클론의 고정커밋을 사용하고 npm ci 후 서버4470만 연다. 증명모드는 사용하지 않는다.

```sh
npm run dev -- --host 127.0.0.1 --port 4470 --strictPort
```

이번 감사의 수집기 `scripts/capture_lands.py`, `scripts/capture_extra.py`, 검증기 `scripts/capture_manifest.py`는 실행 당시의 BASE경로를 보존했다. 다른호스트에서는 이도우미들의BASE/ROOT를 자신의독립클론경로로 바꾸고 PYTHONPATH를추출한 tools/vision-check로 지정한다. 검출소스·설정·카탈로그에는손대지않는다. 도시 원본저장경로와해시는 캡처계획·메타데이터에있고 게임저장소에서 가져온다. 일반CLI는repo/report경로인자를지원한다.

1. 새수집은 별도출력경로로 실행하고 실제seed·camera·tick·asset해시를확인한다. 기록된 15개주장면만사용하며 도시100ms기초캡처는제외하고600ms확인시퀀스를쓴다.
2. 새정답을 검출전에동결한다. 이번 정답을 재사용하는재현실험이면 원본프레임해시일치여부를먼저확인한다. 타이밍/날씨픽셀이달라진 새캡처를 동일입력이라고부르지않는다.
3. raw/장면/capture.json 과각framePNG를 report경로아래두고, 고정 config/expansion.json으로 analyze를실행한다.

```sh
python -m vision_check.cli analyze /path/to/pinned-game /path/to/new-report --config /path/to/tools/vision-check/config/expansion.json --name frozen-results
```

Mac headless Chromium에서 실측완료. DGX Linux headless의실행경로는같지만 이회차에서는DGX를실행하지않았다. Playwright/Chromium시스템의존성설치가필요하다. 검출39.03초는해당Mac15장면만의시간이며수집·수동판독·다른GPU성능보장이아니다.

## 납품 전 필수검사

- ZIP문서가가리키는 실제보고서/그림/JSON은ZIP안에존재해야한다. Markdown링크는실제상대경로를검사하고동명파일로대체통과시키지않는다. 숫자구간은전체멤버가필요하다.
- 원본게임소스·경량납품에서제외한framePNG 같은 외부입력만문서별정확한예외사유를허용한다. 실제누락그림은예외로통과시킬수없다.
- 압축후CRC, 모든SHA256SUMS, 문서참조검사를다시실행하고30MB이하확인한다.

```sh
python3 report/holdout/scripts/audit_archive_links.py /path/to/delivery.zip /tmp/link-audit.json --allowlist report/holdout/link-allowlist.json
```

검사기는누락/모호경로가있으면종료1이다. 이번에복구한이전OBJECT_MATCH4개는로컬원본과ZIP멤버의SHA가동일함도확인한다. 기존교정문서의4개누락을재현했고이동작을참조검사경계검증으로사용했다.
