require 'json'
require 'digest'
require_relative 'adapter'
root=File.dirname(__FILE__)
def copy(value);Marshal.load(Marshal.dump(value));end
record={'template'=>'person.fell_ill','tick'=>4000,'subject'=>{'type'=>'person','id'=>'p-1'},'params'=>{}}
state={'scenarioId'=>'core:campaign_market_town','tick'=>600000,'persons'=>{'people'=>[{'id'=>'p-1','birthYear'=>1271,'alive'=>false,'role'=>'head'}],'past'=>[]}}
cases=[]
check=lambda do |name,r,s,expected|
 before=JSON.generate([r,s]);got=HistoricalAgeProposal.read(r,s)
 raise 'mutation '+name unless before==JSON.generate([r,s])
 raise 'case '+name+': '+got.inspect unless expected.all?{|key,value|got[key]==value}
 cases<<{name:name,result:got}
end
[0,13,14,29,30,54,55,120].each do |age|
 s=copy(state);s['persons']['people'][0]['birthYear']=1301-age
 band=age<14 ? 'child' : age<30 ? 'youth' : age<55 ? 'adult' : 'elder'
 check.call('age_'+age.to_s,record,s,{'status'=>'known','subjectAgeAtRecord'=>age,'subjectAgeBandAtRecord'=>band})
end
[3999,4000,4001].each{|tick|r=copy(record);r['tick']=tick;check.call('tick_'+tick.to_s,r,state,{'status'=>'known','eventYear'=>1300+tick/4000})}
HistoricalAgeProposal::HOUSEHOLD.each{|template|r=copy(record);r['template']=template;check.call(template,r,state,{'status'=>'unknown','reason'=>'household_event'})}
[
 ['unknown_scenario',lambda{|r,s|s['scenarioId']='unknown'},'unknown_scenario'],
 ['missing_person',lambda{|r,s|s['persons']['people']=[]},'person_missing'],
 ['duplicate_across_pools',lambda{|r,s|s['estates']={'people'=>copy(s['persons']['people'])}},'duplicate_person'],
 ['birth_string',lambda{|r,s|s['persons']['people'][0]['birthYear']='1271'},'invalid_birth_year'],
 ['future_birth',lambda{|r,s|s['persons']['people'][0]['birthYear']=1302},'negative_age'],
 ['after_death',lambda{|r,s|s['persons']['people'][0]['deathYear']=1300},'after_death_year'],
 ['future_record',lambda{|r,s|r['tick']=600001},'invalid_tick'],
 ['negative_tick',lambda{|r,s|r['tick']=-1},'invalid_tick'],
 ['fraction_tick',lambda{|r,s|r['tick']=1.5},'invalid_tick'],
 ['bool_tick',lambda{|r,s|r['tick']=true},'invalid_tick'],
 ['actor_subject',lambda{|r,s|r['subject']['type']='actor'},'not_person_subject'],
 ['missing_subject',lambda{|r,s|r.delete('subject')},'not_person_subject'],
 ['bad_pool',lambda{|r,s|s['factions']={'people'=>'bad'}},'invalid_pool'],
 ['bad_params',lambda{|r,s|r['params']=[]},'invalid_params'],
 ['death_age_conflict',lambda{|r,s|r['template']='person.died';r['params']={'age'=>31}},'recorded_age_mismatch']
].each{|name,modify,reason|r=copy(record);s=copy(state);modify.call(r,s);check.call(name,r,s,{'status'=>'unknown','reason'=>reason})}
r=copy(record);r['template']='person.died';r['params']={'age'=>30};check.call('death_age_agrees',r,state,{'status'=>'known','subjectAgeAtRecord'=>30})
s=copy(state);s['persons']['past']=s['persons'].delete('people');check.call('past_pool_same_age',record,s,{'status'=>'known','subjectAgeAtRecord'=>30})
s=copy(state);s['persons']['people'][0].merge!('role'=>'steward','alive'=>true,'leftYear'=>1450);check.call('current_role_alive_left_ignored',record,s,{'status'=>'known','subjectAgeAtRecord'=>30})
source='/Users/rexxa/fls-astra-steward/.remote-runs/astra-steward-N04-r03-5fb1aeb/N04-chalk-2-full/year-1450.fls.json'
sha=Digest::SHA256.file(source).hexdigest;raise 'save drift' unless sha=='b487a43879068c01c6db746ae604d121718114011777d347b802b599752a4ecb'
snapshot=JSON.parse(File.read(source))['state']; records=snapshot['history']['records']
natural=%w[h-050888 h-051206].map do |id|
 r=records.find{|row|row['id']==id};raise 'example absent' unless r
 result=HistoricalAgeProposal.read(r,snapshot);raise 'example unknown' unless result['status']=='known'
 {id:id,template:r['template'],tick:r['tick'],result:result}
end
raise 'known natural values' unless natural[0][:result]['subjectAgeAtRecord']==66 && natural[1][:result]['subjectAgeAtRecord']==14
result={status:'OFFLINE_PROPOSAL_VALIDATED',fixtureCount:cases.size,allInputsUnchanged:true,cases:cases,naturalExamples:natural,sourceSave:source,sourceSha256:sha,engineExecuted:false,selectorInstalled:false,canonicalChanged:false}
File.write(root+'/VALIDATION.json',JSON.pretty_generate(result)+"\n")
puts JSON.generate({status:result[:status],fixtures:cases.size,naturalExamples:natural.size})
