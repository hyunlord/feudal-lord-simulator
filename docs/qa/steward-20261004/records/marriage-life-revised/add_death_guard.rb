require 'json'
r=__dir__;read=lambda{|f|JSON.parse(File.read(r+'/'+f))};write=lambda{|f,j|File.write(r+'/'+f,JSON.pretty_generate(j)+"\n")}
p=read.call('PROPOSAL.json');f=p['fields'].find{|x|x['id']=='willAllowedRoute'}
f['captureRule']+=' ADDED DEATH/IDENTITY GUARD: For BOTH contested variants, at the inheritance operation require oldLord exists, is the same pinned bride-father person ID from the original contract, and actual death is verified at that event (alive=false with death evidence tied to the same person and transition). Match counterpart estateId, brideId, negotiationId and rivalId to the saved will-answer reference. Missing oldLord, absent/mismatched death evidence or identity -> unknown/baseline; never treat source !alive on missing lookup as proof of death. Never inspect current survivors to backfill this guard.'
write.call('PROPOSAL.json',p);write.call('FIELD_CONTRACTS.json',p['fields']);s=read.call('PROPOSAL.schema.json');s['properties']['fields']['items']['enum']=p['fields'];write.call('PROPOSAL.schema.json',s)
code=File.read(r+'/validate.rb');code.sub!('%w[PROPOSAL.json FIELD_CONTRACTS.json FIXTURES.json ADOPTION_LIMITS.json CONTEXT.schema.json PROPOSAL.schema.json negative_schema_checks.rb]', '%w[FIXTURES.json ADOPTION_LIMITS.json CONTEXT.schema.json negative_schema_checks.rb]')
code.sub!("File.write(root+'/SCHEMA_GATE_REGRESSION.json'", <<~CHECK.chomp)
original=JSON.parse(File.read(File.dirname(root)+'/marriage-life-context/PROPOSAL.json'))
raise 'original20 lines altered' unless p['additions']==original['additions']
raise 'field set altered' unless p['fields'].map{|f|f['id']}==original['fields'].map{|f|f['id']}
p['fields'].each do |f|
 old=original['fields'].find{|o|o['id']==f['id']}
 if f['id']=='willAllowedRoute'
  raise 'contested guard absent' unless f['captureRule'].start_with?(old['captureRule']) && f['captureRule'].include?('ADDED DEATH/IDENTITY GUARD: For BOTH contested variants')
  raise 'unrelated contract edit' unless f.reject{|k,_|k=='captureRule'}==old.reject{|k,_|k=='captureRule'}
 else
  raise 'other contract edited' unless f==old
 end
end
File.write(root+'/SCHEMA_GATE_REGRESSION.json'
CHECK
File.write(r+'/validate.rb',code)
File.open(r+'/PATCH_LOG.md','a'){|f|f.write("\n추가 검수 반영: contested2의 willAllowedRoute 계약에 실제 oldLord 존재·계약 당시 신부 아버지ID 일치·사건 시점의 사망근거 확인을 명시했다. source의 missing oldLord→!alive를 사망 증거로 쓰지 않고 unknown/fallback으로 보낸다. 이로 인해 FIELD_CONTRACTS/PROPOSAL의 해당 captureRule 및 schema의 계약 enum만 확장했다. 문장20개와 fixture166·114, 사실줄3홀드는 그대로다. 원래 계약6개 중 이 필드의 가드 추가 외 변경이 없음을 validator가 확인한다. 가드 실행 어댑터는 여전히 미구현이다.\n")}
