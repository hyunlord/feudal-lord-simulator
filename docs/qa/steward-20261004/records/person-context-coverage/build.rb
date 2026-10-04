require 'json'
require 'digest'
root=__dir__;repo='/Users/rexxa/fls-astra-steward';round=File.dirname(File.dirname(root));old='/tmp/astra-steward-r05-20261004/records'
write=lambda{|n,x|File.write(root+'/'+n,JSON.pretty_generate(x)+"\n")}
base=round+'/chronicle/variants.ko.json';old_age=JSON.parse(File.read(old+'/age-context-copy-proposal/ADDITIONS.json'))
classification=JSON.parse(File.read(round+'/records/remaining-coverage-audit/CLASSIFICATION.json'))
remaining=classification['records'].select{|r|r['classification']==2&&r['template'].start_with?('person.')}
coverage=remaining.map do |r|
 prior=old_age['additions'].find{|a|a['template']==r['template']}
 {template:r['template'],existingAgeProposalCount:prior ? prior['variants'].size : 0,existingAxis:prior ? 'historical_age_only' : nil,canonicalConditionalCount:0,remainingFields:r['unavailableFields'],status:prior ? 'EXISTING_20_REUSED_NOT_DUPLICATED_REQUIRES_ADAPTER' : 'NEW_SEPARATE_PROPOSAL_REQUIRES_ADAPTER_OR_EMITTER',complete:false}
end
write.call('COVERAGE.json',{status:'INCOMPLETE_CONTEXT_IMPLEMENTATION',types:coverage})
variants=[]
age=lambda do |template,id,lo,hi,text|
 variants << {id:"#{template}.r06ctx.#{id}",template:template,axis:'historical_age',min:lo,max:hi,headline:text,requiredSlots:['ageAtRecord'],retainFactLine:true,status:'BLOCKED_CONTEXT_ADAPTER'}
end
age.call('person.arrived','young',14,29,'{ageAtRecord}살의 젊은 친척이 가구에 합류했다.')
age.call('person.arrived','elder',55,70,'{ageAtRecord}살의 나이 든 친척이 가구에 합류했다.')
age.call('person.reeve','youth',25,29,'젊은 시절, {ageAtRecord}살에 마을 대표로 뽑혔다.')
age.call('person.reeve','adult',30,54,'{ageAtRecord}살에 마을 대표 일을 맡게 되었다.')
age.call('person.reeve','elder',55,60,'나이 들어, {ageAtRecord}살에 마을 대표로 뽑혔다.')
age.call('person.expecting','youth',16,29,'젊은 시절, {ageAtRecord}살에 아이를 갖게 되었다.')
age.call('person.expecting','adult',30,44,'{ageAtRecord}살에 아이를 갖게 되었다.')
add=lambda{|t,id,field,op,value,text,block|variants<<{id:"#{t}.r06ctx.#{id}",template:t,axis:'emitter_snapshot',field:field,op:op,value:value,headline:text,requiredSlots:[],retainFactLine:true,status:block}}
add.call('person.emptied','one','residentsBefore','eq',1,'한 명이 살던 집이 비었다.','BLOCKED_BASELINE_FACT_LINE_AND_NEW_FIELD')
add.call('person.emptied','many','residentsBefore','gte',2,'여럿이 살던 집이 비었다.','BLOCKED_BASELINE_FACT_LINE_AND_NEW_FIELD')
add.call('person.steward','after_death','predecessorExitAtAppointment','eq','died','앞선 청지기가 세상을 떠난 뒤 새 청지기가 임명되었다.','BLOCKED_NEW_FIELD_REACHABILITY_UNVERIFIED')
add.call('person.steward','after_departure','predecessorExitAtAppointment','eq','left_town','앞선 청지기가 도시를 떠난 뒤 새 청지기가 임명되었다.','BLOCKED_NEW_FIELD_REACHABILITY_UNVERIFIED')
add.call('person.bailiff','artisan','classBandAtAppointment','eq','artisan','장인 가구를 이끌던 이가 영주의 집행관이 되었다.','BLOCKED_NEW_FIELD')
add.call('person.bailiff','merchant','classBandAtAppointment','eq','merchant','상인 가구를 이끌던 이가 영주의 집행관이 되었다.','BLOCKED_NEW_FIELD')
write.call('PROPOSALS.json',{formatVersion:'person-context-sidecar-v1',baselineSha256:Digest::SHA256.file(base).hexdigest,status:'NOT_CANONICAL_NOT_INSTALLED',existingAge20Duplicated:false,variants:variants})
File.write(root+'/age_adapter.rb',File.read(old+'/historical-age-adapter-proposal/adapter.rb'))
inputs=%w[age-context-copy-proposal/ADDITIONS.json age-context-copy-proposal/VALIDATION.json age-context-copy-proposal/NATURAL_SAMPLES.json historical-age-contract/CONTRACT.md historical-age-adapter-proposal/adapter.rb]
write.call('INHERITED_EVIDENCE.json',inputs.map{|p|{path:old+'/'+p,sha256:Digest::SHA256.file(old+'/'+p).hexdigest}})
spans={'src/engine/history.ts'=>[[335,382],[388,427]],'src/engine/persons.ts'=>[[373,387],[477,483],[510,543],[832,848]],'src/content/historyCopy.ko.ts'=>[[342,370]],'src/engine/historyNames.ts'=>[[1,18],[43,54]],'docs/design/glossary.md'=>[[19,23],[191,191]]}
write.call('SOURCE_EVIDENCE.json',spans.map{|p,rs|text=File.read(repo+'/'+p);{path:p,sha256:Digest::SHA256.hexdigest(text),spans:rs.map{|a,b|{start:a,end:b,text:text.lines[(a-1)..(b-1)].join}}}})
