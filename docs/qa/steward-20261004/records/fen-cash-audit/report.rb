require 'json'; require 'digest'
d=__dir__;x=JSON.parse(File.read("#{d}/DATA.json"));f=x['runs']['fen'];o=x['runs']['open'];rows=x['comparison']['categories']
src=JSON.parse(File.read("#{d}/SOURCE_SHA256.json"));old=JSON.parse(File.read('/tmp/astra-steward-r08-20261004/inherited/R07/analysis/seed3-cash-attribution-r07/SOURCE_SHA256.json'));raise 'source mismatch' unless src.all?{|s|old.include?(s)}
File.write("#{d}/REPORT.md",<<~DOC)
# Fen / open seed3 고정 성장 현금 대사

최종 금고 차이 **425610d = 543952d − 118342d**는 cash 원장의 범주별 순액 차이로 전액 대사된다. **범주 미배정 차이 0d**. 두 시작 저장은 tick0, 금고60d, ledger 없음이며 최종 저장은 tick600000이다. 순현금 변화는 fen543892d, open118282d다. 첫 전기에 포함된 opening_balance60d를 다시 더하지 않았다.

## 집계 계약과 검증

기존 R07 현금 검산과 동일하게 account=cash인 entries와 rollups.byCategory만 합했다. restricted/arrears/in_kind는 제외했다. ledger.ts:51–71의 계정 합과 시작 잔고 규칙, :74–107의 압축, :141–148의 opening을 읽었고 현재 세 소스 SHA가 R07 핀과 일치한다.

두 판 각각 전체 entry ID 중복 없음, cash rollup 기간 유효·겹침 없음, entry와 rollup 기간 겹침 없음, 금액 정수, 금고 합계 일치, 시작 ledger 없음, opening 잔고 일치, 최종tick600000의 9조건을 통과했다. 차이 합계도 정확하다. 이것은 저장 원장의 내부 대사이며 모든 게임 비용의 누락 여부나 세계 전체 회계를 증명하지 않는다.

| 보존 범위 | fen | open |
| --- | ---: | ---: |
| cash entries | #{f['entryCount']} | #{o['entryCount']} |
| entry tick | 588000–600000 | 588000–600000 |
| cash rollups | 116 | 116 |
| rollup 범위(끝 제외) | [0,588000) | [0,588000) |

## 정확한 범주 분해

단위 d(페니), 차이는 fen−open이다. 아래는 **수입·지출 범주의 signed net**이며 총수익·총지출(gross)이 아니다. 비용 차이가 양수이면 상대적으로 덜 지출했을 수 있다는 뜻이지 새 수입을 의미하지 않는다. 범주 이름만으로 부호를 바꾸지 않았다.

| category | fen 순액 | open 순액 | 차이 |
| --- | ---: | ---: | ---: |
#{rows.map{|r|"| #{r['category']} | #{r['fenNet']} | #{r['openNet']} | #{r['difference']} |"}.join("\n")}
| 합계 | 543952 | 118342 | 425610 |

estate_income 차이 **417024d**, 나머지 **8586d**다. 나머지에 포함된 audit_recovery1472d는 별도 회수 범주이며 estate_income에 섞지 않았다. 이를 제외한 나머지는7114d다.

## estate_income 출처와 압축 한계

stewardship.ts:333–335는 지도 밖 영지 계절 보고액을 이 범주에 기록한다. 그러나 :228–229,447–458도 홈·지도 밖 청원 조정을 같은 범주에 기록한다. 따라서 범주 차이 전체를 특정 영지의 계절 수익으로 부르면 안 된다.

| 범위 | fen | open | 차이 |
| --- | ---: | ---: | ---: |
| 전체 estate_income | 413774 | -3250 | 417024 |
| 출처 없는 rollup 순액 | #{f['categories']['estate_income']['rollupNet']} | #{o['categories']['estate_income']['rollupNet']} | #{f['categories']['estate_income']['rollupNet']-o['categories']['estate_income']['rollupNet']} |
| 출처 보존 entry 순액 | 8536 | -23 | 8559 |
| 보존 홈 청원 조정 | -23 | -23 | 0 |
| 보존 영지3 보고 형태 | 8559 | 0 | 8559 |

fen의 최근8559d는13개 entry이며 actor estate:estate-neighbour-3와 person:est-000018 조합, claim 참조 없음이다. 생산자 코드의 계절 보고 형태와 일치한다. 두 판의 홈 조정은 chancel_repair−47d 및 merchet+8d,+16d로 순−23d다. 정확한 claim ID와 전기 원자료는 DATA에 있다.

**408465d는 sourceRefs 없는 오래된 rollup의 순액 차이**다. 이는 출처 미분해 signed net이며 총거래액의 상한·하한이 아니다. 압축은 범주 합을 유지하지만 개별 sourceRefs·tick·양수/음수 거래를 잃는다. 개별 영지·청원·계절의 150년 gross를 최종 저장만으로 복구할 수 없다. DATA의 retainedPositive/retainedNegative는 보존 entries만 대상으로 하며 전기간으로 외삽하지 않았다.

## 해석과 산출물 범위

동일 seed와 고정 성장 방침이어도 혼인·취득·관리·청원 경로는 달라질 수 있다. 본 감사는 현금 범주 분해이며 **425610d를 fen 지형의 직접 효과, 토지 자체 수익, 성장 방침의 이익으로 판정하지 않는다.** 최근 영지 보고를 관측했어도 전체 차이의 개별 출처나 인과를 확정하지 않는다. open 저장의 archetypeId는 누락되어 DATA에서 null로 보존했다. open 명칭은 기존 실행 폴더 구분에 따른다.

INPUT_SHA256.json은 시작/최종 네 저장, SOURCE_SHA256.json은 현재 소스, REFERENCE_SHA256.json은 기존 R07 계약을 핀으로 남긴다. DATA.json에 범주 합·보존 원장 사본·출처별 합·검사가 있고 VALIDATION.json은 검증 결과다. audit.rb로 경량 재계산할 수 있다. 기존 저장과 원고·엔진을 수정하지 않았으며 엔진/SSH/브라우저를 실행하지 않았다.

Graft ledger skeleton의 도구 추정 절약량은1559토큰이다. 이미 알려진 계약 소스의 직접 읽기도 수행했다.
DOC
inputs=JSON.parse(File.read("#{d}/INPUT_SHA256.json")); unchanged=inputs.all?{|i|Digest::SHA256.file(i['path']).hexdigest==i['sha256']};raise 'input mutated' unless unchanged
File.write("#{d}/VALIDATION.json",JSON.pretty_generate({runs:x['runs'].transform_values{|v|v['checks']},sourcePinsMatchR07:true,inputUnchanged:unchanged,categoryDifferenceReconciles:x['comparison']['unassignedDifference']==0,engineExecutions:0,sshCalls:0})+"\n")
File.write("#{d}/SHA256SUMS",Dir.children(d).reject{|n|n=='SHA256SUMS'}.sort.map{|n|"#{Digest::SHA256.file("#{d}/#{n}").hexdigest}  #{n}\n"}.join)
puts Digest::SHA256.file("#{d}/REPORT.md").hexdigest
