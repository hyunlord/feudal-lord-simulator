#147: 시대창32계절의 확률 관문 검증

**seed1의1348–1355 창32계절은 사건 확률 관문을 모두 통과하지 못한다.** 요청 범주는 **조건이 너무 좁음 — 정해진 시대창의 사건 확률 조건**으로 분류한다. 이 seed/창에서 무노출을 설명하는 충분한 근거이며 밸런스가 나쁘다는 판정은 아니다.

실제 첫 gate는28pace·2chance·2budget이다. 아래32개 draw 중 **실제 방문은219000/223000 두 번뿐**이다. 나머지30개는 동일 source/seed/계절 index를 사용한 순수 산술이다. 선행 gate를 모두 통과하더라도 고정된 chance 조건이 모두 실패하므로, 원래 무노출 원인을 분류하는 데 추가 상태 재현이나 binder 검사는 필요하지 않다.

원본 `registryV4.ts:392–407`의 pace는 남은 일회성 사건 수와 최종 창 종료까지의 계절 수로 계산하는 공유 확률 관문이다. 일정 간격 보장이나 literal cooldown이 아니다. 사건별 chance는 `:418–419`의 `hashSeed(1,"registry-v4:ck_evt_147",floor(tick/1000))%1000 <150`이다.

| tick | offline draw | 실제 첫 gate | chance 실제 방문 |
|---:|---:|---|---|
|192000|576|once_or_pace|아니오|
|193000|416|once_or_pace|아니오|
|194000|477|once_or_pace|아니오|
|195000|597|once_or_pace|아니오|
|196000|317|once_or_pace|아니오|
|197000|924|once_or_pace|아니오|
|198000|938|budget|아니오|
|199000|755|budget|아니오|
|200000|790|once_or_pace|아니오|
|201000|326|once_or_pace|아니오|
|202000|942|once_or_pace|아니오|
|203000|325|once_or_pace|아니오|
|204000|596|once_or_pace|아니오|
|205000|674|once_or_pace|아니오|
|206000|901|once_or_pace|아니오|
|207000|842|once_or_pace|아니오|
|208000|301|once_or_pace|아니오|
|209000|733|once_or_pace|아니오|
|210000|364|once_or_pace|아니오|
|211000|453|once_or_pace|아니오|
|212000|231|once_or_pace|아니오|
|213000|336|once_or_pace|아니오|
|214000|603|once_or_pace|아니오|
|215000|643|once_or_pace|아니오|
|216000|942|once_or_pace|아니오|
|217000|571|once_or_pace|아니오|
|218000|167|once_or_pace|아니오|
|219000|833|chance|예|
|220000|666|once_or_pace|아니오|
|221000|430|once_or_pace|아니오|
|222000|552|once_or_pace|아니오|
|223000|859|chance|예|

최솟값167(tick218000)도150 이상이다. 실제 chance 방문의 값은219000→833,223000→859로 원문 witness와 일치한다. budget 시점198000→938,199000→755는 가정적 계산이다.

## 재현 명령 — 실행 확인

저장소 루트에서 실행한다. 기존 순수 content hash만 import하고 engine·state·tick을 실행하지 않는다. 당시 source 네 파일의 SHA와 현재 hash 함수의 원본 byte 동일성을 확인한 뒤32개 값을 다시 계산한다.

```sh
node --import tsx - <<'NODE'
import { hashSeed } from './src/content/seedHash.ts';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const data = JSON.parse(readFileSync('docs/verification/eb-freq/147-chance-window.json'));
const sha = b => createHash('sha256').update(b).digest('hex');
for (const source of data.sources) {
  const bytes = execFileSync('git', ['show', `${data.sourceRevision}:${source.path}`]);
  assert.equal(sha(bytes), source.sha256);
  if (source.path === 'src/content/seedHash.ts') assert.deepEqual(readFileSync(source.path), bytes);
}
assert.equal(data.rows.length, 32);
for (const [i, row] of data.rows.entries()) {
  assert.equal(row.hashSeasonIndex, 192 + i);
  assert.equal(row.tick, (192 + i) * 1000);
  assert.equal(hashSeed(1, 'registry-v4:ck_evt_147', 192 + i), row.hashUint32);
  assert.equal(row.hashUint32 % 1000, row.offlineDraw);
  assert.equal(row.chancePermille, 150);
  assert(row.offlineDraw >= 150);
}
console.log('PASS: 32/32 chance failures; historical source hashes and pure-hash byte equality verified; no engine execution');
NODE
```

위 명령을 실제 실행해32/32 실패 및 source 검증 PASS를 확인했다. 전체 raw hash값·gate 원문/행 번호·source SHA는 [JSON](147-chance-window.json)에 있다. 관측 gate는 검증된 역사 stream에서 추출했으며, 재현 명령은 순수 산술과 source 핀을 검증한다.

## 출처와 범위

- Gameplay `56ee1d9d8259f89e6122153cedd82e783a74f5c7`; tool `27599bd5ace470476a8ee0be727535b34a0373a5`.
- Manifest SHA256 `91bdcf3dd03e9e9d36b2bb06d138c90d29e386877ac9830ea47f0604363b2cfc`.
- JSON SHA256 `19ab8a1f9f4a943106f2c9a169cac47cf28b42d49341a71f68036cadd56fb0fe`.
- `src/content/seedHash.ts`는 원본과 현재 파일이 byte 동일하다. source SHA는 JSON `sources`에 보존했다.
- binder/context/선택지 적격성은 여전히 미검증이다. 이는 무노출 설명의 미분류 사유가 아니라, 이 확률 차단 뒤에 가려진 별도 질문이다. 다른 seed나 수정된 chance의 도달 가능성으로 일반화하지 않는다.

계획했던 DGX `engineB-147-probe-07004ff`는 대기 중 이 충분조건이 확인되어 실행 전에 취소했다. 원격 unit inactive/dead와 probe 출력 부재를 확인했다. 실행되지 않은56년 재현을 검증 근거로 세지 않는다.
