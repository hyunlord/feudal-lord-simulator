# EB-TLINK — 감사94건의 정확한 처리 대응

공식 실행 `engineB-tlink-audit125-23d1226`, 제품 소스 `23d12264289538de5f6ef3ef3f36aa9257b10aba`의 보존 원본을 오프라인으로 연결한 증거다. **94건의 정확한 답·감사·처리 영수증 대응**을 확인했다. 43건은 자기 root와 최종 보존 감사가 함께 대상을 뒷받침하고,51건은 정확한 최종 감사 ID로 확인했다. 이름이나 병합 root만으로 대상을 추정하지 않았다.

이는 같은 tick의 감사 처리 상태 증거다. 직접 감사 전후 snapshot 증명0건·충성도 delta 증명0건은 **미관측**이라는 뜻이며 실제 충성도 변화가0이라는 뜻이 아니다. 처리 상태만으로 새 기준 (a) 실질 결과가 보였다고 판정하지 않는다.

기존 미래 연결 점수 **334/816**과 원본 score 바이트는 바뀌지 않았다. 이 증거를 적용한 기존 잔여 주석의 즉시 처리397·설명 미완85는 legacy annotation이며, 새 네 범주 점수나 c≤10% 통과가 아니다. 원래 잔여 입력303·179·20과 연결되는 근거를 보존했고 원본을 덮어쓰지 않았다.

## 보관과 검증

- `tlink-audit-settlement-23d.py.gz`, `tlink-audit-settlement-23d.json.gz`: 실제 ignored 원본 두 파일을 byte 그대로 복원할 수 있는 gzip.
- [manifest](manifest.json): 압축 전후 SHA256·크기, 실행/소스 핀, 모든 입력 해시, 원래 점수와 해석 한계.
- [SHA256SUMS](SHA256SUMS): 이 compact 보관 파일들의 해시. 큰 raw·context·state는 복제하지 않았다.
- [공식125년 원본 보관](../eb-tlink-outcomes/README.md): 원본 fetch 및 seed별 구성원 인덱스.

## 재현

소스와 도구 핀이 맞는 별도 checkout에 원래 `.remote-runs/engineB-tlink-audit125-23d1226/eb-tlink-audit-final` 입력, `.omo/evidence/final-23d-score.json`, 원래 `.omo/evidence/final-23d-residuals.json`을 복원한다. 압축 script를 `.omo/evidence/tlink-audit-settlement-23d.py`로 복원하고 다음 명령을 실행한다.

```sh
python3 .omo/evidence/tlink-audit-settlement-23d.py
```

도구는 같은 위치의 출력 JSON이 이미 있으면 거부한다. 보관된 JSON을 지우거나 덮어쓰지 말고 출력이 없는 별도 checkout에서 재현한다. 생성한 JSON을 manifest의 raw SHA와 대조한다. 이 과정은 엔진이나 새 시뮬레이션을 실행하지 않는다. 이 보관 작업에서는 생성기를 다시 실행하지 않고 원본/압축 바이트와 입력 해시를 검증했다.
