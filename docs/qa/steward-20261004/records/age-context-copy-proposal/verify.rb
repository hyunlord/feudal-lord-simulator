require 'json'
require 'digest'
require_relative '../historical-age-adapter-proposal/adapter'
root=File.dirname(__FILE__);package=JSON.parse(File.read(root+'/ADDITIONS.json'))
base='/tmp/astra-steward-r05-20261004/chronicle/variants.ko.json';before=Digest::SHA256.file(base).hexdigest
raise 'base' unless before==package['baselineSha256']
variants=package['additions'].flat_map{|g|g['variants']};raise 'count' unless variants.size==20 && variants.map{|v|v['id']}.uniq.size==20
raise 'name/privacy' unless variants.all?{|v|v['requiredSlots']==['ageAtRecord']&&v['retainFactLine']==true&&v['headline'].scan(/\{([^}]+)\}/).flatten==['ageAtRecord']}
def choose_and_render(package,record,state)
 context=HistoricalAgeProposal.read(record,state)
 return {'status'=>'baseline','reason'=>context['reason']} unless context['status']=='known'
 group=package['additions'].find{|g|g['template']==record['template']}
 return {'status'=>'baseline','reason'=>'template_not_in_package'} unless group
 matches=group['variants'].select do |v|
  v['when'].all? do |q|
   value=context[q['field'].delete_prefix('context.')]
   case q['op'];when 'eq';value==q['value'];when 'gte';value.is_a?(Integer)&&value>=q['value'];when 'lte';value.is_a?(Integer)&&value<=q['value'];else;raise 'unknown operator';end
  end
 end
 raise 'overlap' if matches.size>1
 return {'status'=>'baseline','reason'=>'age_not_supported'} if matches.empty?
 v=matches.first;age=context['subjectAgeAtRecord'];raise 'unsafe slot' unless age.is_a?(Integer)&&age>=0
 {'status'=>'candidate','id'=>v['id'],'headline'=>v['headline'].gsub('{ageAtRecord}',age.to_s),'context'=>context}
end
cases=[]
package['additions'].each do |g|
 [0,13,14,17,18,29,30,54,55,60,61].each do |age|
  record={'template'=>g['template'],'tick'=>4000,'subject'=>{'type'=>'person','id'=>'p-1'}}
  state={'scenarioId'=>'core:campaign_market_town','tick'=>600000,'persons'=>{'people'=>[{'id'=>'p-1','birthYear'=>1301-age}]}}
  frozen=JSON.generate([record,state]);got=choose_and_render(package,record,state)
  allowed=case g['template'];when 'person.injured';(14..60).include?(age);when 'person.healed';age>=14;when 'person.pilgrimage';(18..60).include?(age);when 'person.returned';age>=18;else;true;end
  raise 'boundary' unless (got['status']=='candidate')==allowed
  raise 'age rendering' if allowed && !got['headline'].include?(age.to_s+'살')
  raise 'input mutated' unless frozen==JSON.generate([record,state])
  cases<<{template:g['template'],age:age,result:got}
 end
end
%w[unknown duplicate household].each do |kind|
 record={'template'=>kind=='household' ? 'person.move_in' : 'person.fell_ill','tick'=>4000,'subject'=>{'type'=>'person','id'=>'p-1'}}
 state={'scenarioId'=>'core:campaign_market_town','tick'=>600000,'persons'=>{'people'=>kind=='unknown' ? [] : [{'id'=>'p-1','birthYear'=>1271}]}}
 state['persons']['past']=[{'id'=>'p-1','birthYear'=>1271}] if kind=='duplicate'
 got=choose_and_render(package,record,state);raise 'fallback' unless got['status']=='baseline';cases<<{rejection:kind,result:got}
end
source='/Users/rexxa/fls-astra-steward/.remote-runs/astra-steward-N04-r03-5fb1aeb/N04-chalk-2-full/year-1450.fls.json'
raise 'source drift' unless Digest::SHA256.file(source).hexdigest=='b487a43879068c01c6db746ae604d121718114011777d347b802b599752a4ecb'
snapshot=JSON.parse(File.read(source))['state'];records=snapshot['history']['records'];pools=[snapshot.dig('persons','people'),snapshot.dig('persons','past'),snapshot.dig('factions','people'),snapshot.dig('estates','people')].compact.flatten
by_id=pools.group_by{|p|p['id']};wanted=package['additions'].map{|g|g['template']};seen={};samples=[]
records.each do |record|
 next unless wanted.include?(record['template']) && record.dig('subject','type')=='person'
 people=by_id[record.dig('subject','id')];next unless people && people.size==1
 age=1300+record['tick']/4000-people.first['birthYear'];band=age<14 ? 'child' : age<30 ? 'youth' : age<55 ? 'adult' : 'elder';key=record['template']+':'+band
 next if seen[key]
 got=choose_and_render(package,record,snapshot);next unless got['status']=='candidate'
 seen[key]=true;samples<<{recordId:record['id'],subjectId:record.dig('subject','id'),tick:record['tick'],template:record['template'],result:got}
end
raise 'canonical mutated' unless Digest::SHA256.file(base).hexdigest==before
File.write(root+'/NATURAL_SAMPLES.json',JSON.pretty_generate({source:source,sha256:Digest::SHA256.file(source).hexdigest,samples:samples,scope:'First retained matching record per template/band; offline read adapter plus proposed formatter, no engine execution'})+"\n")
File.write(root+'/FIXTURE_RESULTS.json',JSON.pretty_generate(cases)+"\n")
result={status:'OFFLINE_CONTEXT_TO_COPY_PASSED',candidateCount:20,templates:6,fixtures:cases.size,naturalSampleBranches:samples.size,canonicalCount:629,canonicalUnchanged:true,engineInstalled:false,runtimeFormatterExecuted:false,fullSchemaValidation:false}
File.write(root+'/VALIDATION.json',JSON.pretty_generate(result)+"\n");puts JSON.pretty_generate(result)
