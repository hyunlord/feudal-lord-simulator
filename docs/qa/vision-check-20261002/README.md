# Charter & Kin 시각 자연스러움 검사기

소스·설치·실행: [tools/vision-check/README.md](tools/vision-check/README.md)

실측 정밀도와 미충족 조건: [PRECISION.md](PRECISION.md). 여섯 검출기 전부 80% 달성은 미입증이다.

본선 상위 관측: [report/TOP10.md](report/TOP10.md). 직접 판정 전체: [report/main/HUMAN_REVIEW.md](report/main/HUMAN_REVIEW.md).

`report/main`은 동일 카메라 36장면, `report/holdout`은 별도 숲 6장면. `report/calibration-before`는 각도 문턱 강화 전 25건을 모두 판정한 기록이다.

각 metadata/*.json.gz에 20프레임의 관측값을 보존했다. frame-manifest.json은 원본 PNG SHA256이며 JPEG 해시와 다르다. ZIP의 전체 파일 무결성은 SHA256SUMS로 확인한다.

원본 PNG는 `/Users/rexxa/fls-astra-vision/report/full-main/raw`와 `full-holdout/raw`에 있다. 도구는 `/Users/rexxa/fls-astra-vision/tools/vision-check`에 있다.

기존 코드 수정·커밋·푸시 없음. 4470 서버 종료. DGX 실행은 미검증.
