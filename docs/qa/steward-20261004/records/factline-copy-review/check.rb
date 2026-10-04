require 'json'
require 'digest'
require 'fileutils'
require 'open3'
root='/tmp/astra-steward-r06-20261004'
repo='/Users/rexxa/fls-astra-steward'
out=__dir__
sha=->(p){Digest::SHA256.file(p).hexdigest}
proposal=JSON.parse(File.read(root+'/records/factline-copy-proposal/PROPOSALS.json'))
source=repo+'/'+proposal['sourceFile']
original=File.read(source)
raise 'source sha drift' unless sha.call(source)==proposal['sourceSha256']
head,status=Open3.capture2('git','rev-parse','HEAD',chdir:repo)
raise 'source head drift' unless status.success? && head.strip==proposal['sourceHead']
canonical=root+'/chronicle/variants.ko.json'
canonical_before=sha.call(canonical)
entries=proposal.fetch('entries')
raise 'count' unless entries.size==14 && entries.map{|e|e['template']}.uniq.size==14
evidence=JSON.parse(File.read(root+'/records/factline-copy-proposal/SOURCE_EVIDENCE.json'))
spans=0
evidence.each do |f|
 p=repo+'/'+f['path']; raise "source mismatch #{p}" unless sha.call(p)==f['sha256']
 lines=File.readlines(p)
 f['spans'].each{|s|spans+=1; raise 'span mismatch' unless lines[(s['start']-1)..(s['end']-1)].join==s['text']}
end
expected=original.dup
entries.each do |e|
 raise 'original line mismatch' unless original.lines[e['line']-1].chomp==e['old']
 raise 'slot mismatch' unless e['old'].scan(/\$\{[^}]*\}/)==e['new'].scan(/\$\{[^}]*\}/)
 raise 'duplicate source' unless expected.scan(e['old']).size==1
 expected.sub!(e['old'],e['new'])
end
copy=out+'/application-check'
FileUtils.mkdir_p(copy+'/src/content')
File.write(copy+'/src/content/historyCopy.ko.ts',original)
patch=root+'/patches/factline-copy-r06/historyCopy.ko.ts.patch'
logs=[]
[['git','apply','--check',patch],['git','apply',patch]].each do |cmd|
 stdout,stderr,status=Open3.capture3(*cmd,chdir:copy)
 logs<<{'argv'=>cmd,'exit'=>status.exitstatus,'stdout'=>stdout,'stderr'=>stderr}
 raise 'apply failed' unless status.success?
end
actual=File.read(copy+'/src/content/historyCopy.ko.ts')
raise 'extra changes' unless actual==expected
raise 'author proposed mismatch' unless actual==File.read(root+'/records/factline-copy-proposal/proposed.txt')
raise '14 line delta' unless original.lines.zip(actual.lines).count{|a,b|a!=b}==14
paths=%w[person-life-revised/PROPOSALS.json person-context-coverage/PROPOSALS.json marriage-life-revised/PROPOSAL.json event-context-revised/PROPOSAL.json office-context-revised/PROPOSAL.json reorg-context/PROPOSAL.json milestone-context/ADDITIONS.json legacy-town-context/PROPOSAL.json event-context-wave2-revised/PROPOSAL.json]
index={}
paths.each do |rel|
 p=root+'/records/'+rel; d=JSON.parse(File.read(p)); rows=d.is_a?(Array) ? d : (d['additions'] || d['variants'] || [])
 rows.each{|row|v=row['variant'] || row; index[v['id']]={'candidate'=>v,'file'=>'records/'+rel,'sha256'=>sha.call(p)}}
end
notes={
 'person.fed'=>'부족 표식 해제만 기본행에 남긴다. headline은 capture.rb의 residentsAfter > 0 및 정확한 기간 계산 가드 하에서만 허용.',
 'person.emptied'=>'거주자 수가 양수에서 0으로 바뀐 사실만 남기므로 굶주림·사망·이주의 원인을 만들지 않는다.',
 'marriage.brother_in_law_born'=>'살아 있는 oldLord의 아들 출생 및 claimStrength 감소. 재혼 단정 제거. 계약 당시 신랑 관계 캡처가 별도로 필요.',
 'marriage.inherited'=>'영주의 아내라는 한정 제거. 혼인 약정 및 title LORD 귀속 경로와 정합. 관계는 계약 당시 값만 허용.',
 'stewardship.began'=>'새 oversight 추가를 관리 기록으로 표현. 기존 소유 영지의 관리 설정과 소유권 취득을 혼동하지 않는다. steward 이름은 read-time 해석 유지.',
 'reorg.weavers_left'=>'weaverLeavers는 누적 이주 가구 수. 직조공 신분·행선지를 단정하지 않음. refused/expired 발생 조건과 시간 선후만 표현.',
 'plague.priest_died'=>'curacy 신규 생성은 공석만 증명한다. 사망자 신원·사인·교회 전체 무인 상태는 주장하지 않는다.',
 'milestone.market_town'=>'era가 hamlet이 아닌 표본에 미등록 이정표를 추가한다. 석벽 단계에서 뒤늦게 기록되어도 진입 시점으로 오독하지 않음.',
 'legacy.market_fire'=>'설정 수리비와 실제 post.moved를 구분. full/partial/zero headline은 정확한 해당 post 호출 캡처 필요.',
 'legacy.nave_rebuilt'=>'accept 시 즉시 설정되는 naveRebuilt는 준공 증거가 아니다. headline의 증축이 기록되었다는 행정 기록 의미로 승인; 준공 의미 확장 금지. 비용은 정확한 post.moved만 사용.',
 'legacy.charter_refused'=>'accept 이외의 응답에 대한 기록. expired headline과 영주가 명시 거절했다는 모순 해소.',
 'decision.market_town'=>'선포는 건설 부지 생성이며 벽 완공이 아니다. 물길을 경계로 삼는 분기도 목책 경계 선정이라는 표현과 양립.',
 'person.came_of_age'=>'14세 경계 통과는 게임의 어른 분류만 증명. 노동 시작·법적 성년·후견 해제 아님. 새 문맥 후보는 별도 검수.',
 'milestone.stone_town'=>'stone_town era 표본의 이정표 기록이며 성벽 준공 감사 아님. 새 문맥 후보는 별도 검수.'}
verdicts=entries.map{|e|{'template'=>e['template'],'verdict'=>'APPROVE_DRAFT_FACT_LINE','reason'=>notes.fetch(e['template']),'old'=>e['old'],'new'=>e['new'],'evidence'=>e['evidence']}}
combos=entries.flat_map do |e|
 e['relatedHeldCandidateIds'].map do |id|
  item=index.fetch(id); {'id'=>id,'template'=>e['template'],'headline'=>item['candidate'].fetch('headline'),'factLineSource'=>e['new'],'candidateSource'=>item['file'],'candidateSha256'=>item['sha256'],'verdict'=>'APPROVE_COMPOSITION_CONDITIONAL_CAPTURE_AND_SELECTOR','reason'=>notes.fetch(e['template']),'runtimeApproved'=>false}
 end
end
raise '23 links' unless combos.size==23 && combos.map{|x|x['id']}.uniq.size==23
raise 'source modified' unless sha.call(source)==proposal['sourceSha256']
raise 'canonical modified' unless sha.call(canonical)==canonical_before
result={'status'=>'PASS_OFFLINE_DRAFT_REVIEW','sourceHead'=>head.strip,'sourceSha256'=>sha.call(source),'patchSha256'=>sha.call(patch),'appliedCopySha256'=>sha.call(copy+'/src/content/historyCopy.ko.ts'),'factLinesApproved'=>14,'compositionConditionalApproved'=>23,'compositionHeld'=>0,'sourceFilesVerified'=>evidence.size,'sourceSpansVerified'=>spans,'exact14LinesChanged'=>true,'interpolationExpressionsUnchanged'=>true,'sourceUnchanged'=>true,'canonicalSha256'=>canonical_before,'canonicalUnchanged'=>true,'runtimeExecuted'=>false,'engineInstalled'=>false,'contextCaptureImplemented'=>false,'oldHoldLedgersChanged'=>false,'separateNewCandidateReview'=>['person.came_of_age','milestone.stone_town']}
{'RESULT.json'=>result,'FACTLINE_VERDICTS.json'=>verdicts,'COMPOSITION_VERDICTS.json'=>combos,'APPLY_LOG.json'=>logs}.each{|name,data|File.write(out+'/'+name,JSON.pretty_generate(data)+"\n")}
puts JSON.pretty_generate(result)
