require 'json';require 'digest'
root='/tmp/astra-steward-r06-20261004';candidate=root+'/records/fixed-context-revised';patch=root+'/patches/factline-copy-r06/historyCopy.ko.ts.patch';engine='/Users/rexxa/fls-astra-steward/src/content/historyCopy.ko.ts'
inputs=Dir[candidate+'/*'].select{|f|File.file?(f)}+[patch,engine]
before=inputs.map{|f|[f,Digest::SHA256.file(f).hexdigest]}.to_h
p=JSON.parse(File.read(candidate+'/PROPOSAL.json'));limits=JSON.parse(File.read(candidate+'/ADOPTION_LIMITS.json'));fields=JSON.parse(File.read(candidate+'/FIELD_CONTRACTS.json'))
added={};removed={}
File.readlines(patch).each do |line|
 m=line.match(/^([+-])\s+"([^"]+)": \(\) => "([^"]+)",/)
 next unless m
 (m[1]=='+' ? added : removed)[m[2]]=m[3]
end
notes={
 'person.came_of_age'=>'연령 경계에 따른 성장을 말하며 실제 일 배정·돌봄·부모 사망 원인을 덧붙이지 않는다. 부모 동거는 수정된 당시 people 소속/alive/leftYear 없음/같은 householdId 계약이 필요하다.',
 'milestone.stone_town'=>'도시 이정표의 기록과 성벽 구간 completed 속성을 구분한다. 모든 completed가 true여도 석재 교체 완공·방어선 봉합을 뜻하지 않는다. 새 사실행은 물리 완공 단정을 제거한다.',
 'plague.priest_died'=>'사제 자리가 비었다는 curacy 공석 사실과 교회/예배당 건물 유무를 결합한다. 실제 사제의 사망·사인·신앙활동 부재는 주장하지 않는다.'}
rows=limits['compositionHolds'].map do |hold|
 a=p['additions'].find{|x|x['variant']['id']==hold['variantId']};raise 'missing variant' unless a
 v=a['variant'];t=a['template'];raise 'slots' unless v['requiredSlots']==[]&&v['retainFactLine']==true
 raise 'patch missing' unless added[t]&&removed[t]
 raise 'engine not old' unless File.read(engine).include?('"'+t+'": () => "'+removed[t]+'"')
 raise 'unexpected slot' if (v['headline']+added[t]).match?(/[{}]/)
 {variantId:v['id'],template:t,headline:v['headline'],proposedFactLine:added[t],composedText:v['headline']+"\n"+added[t],currentEngineFactLine:removed[t],proposedCompositionVerdict:'DRAFT_COMPOSITION_PASS',currentEngineHold:'RETAIN',captureContract:fields.find{|f|f['templates'].include?(t)},reason:notes.fetch(t),engineExecuted:false,uiRendered:false}
end
raise 'count' unless rows.size==7
sources=JSON.parse(File.read(candidate+'/SOURCE_EVIDENCE.json'))
sources.each{|s|body=File.read('/Users/rexxa/fls-astra-steward/'+s['path']);raise 'source sha drift' unless Digest::SHA256.hexdigest(body)==s['sha256'];s['spans'].each{|span|raise 'source span drift' unless body.lines[(span['start']-1)...span['end']].join==span['text']}}
File.write(__dir__+'/COMPOSITIONS.json',JSON.pretty_generate(rows)+"\n")
rows.each_with_index{|row,i|File.write(__dir__+"/#{i+1}-#{row[:template]}.json",JSON.pretty_generate(row)+"\n")}
raise 'input changed' unless before.all?{|f,sha|Digest::SHA256.file(f).hexdigest==sha}
File.write(__dir__+'/CHECKS.json',JSON.pretty_generate({proposedCompositionPass:7,currentEngineHoldsRetained:7,sourceFiles:sources.size,sourceSpans:sources.sum{|s|s['spans'].size},inputHashes:before,inputsUnmodified:true,slotsAdded:0,runtimeInstalled:false})+"\n")
