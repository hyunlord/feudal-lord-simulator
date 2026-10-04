require 'json'
require 'digest'
require_relative 'age_adapter'
ROOT=__dir__
pkg=JSON.parse(File.read(ROOT+'/PROPOSALS.json'));vs=pkg['variants'];base=File.dirname(File.dirname(ROOT))+'/chronicle/variants.ko.json'
raise 'canonical drift' unless Digest::SHA256.file(base).hexdigest==pkg['baselineSha256']
raise '13 unique candidates' unless vs.size==13 && vs.map{|v|v['id']}.uniq.size==13
raise 'baseline retention' unless vs.all?{|v|v['retainFactLine']==true && v['status'].start_with?('BLOCKED_')}
prior=JSON.parse(File.read('/tmp/astra-steward-r05-20261004/records/age-context-copy-proposal/ADDITIONS.json'))
raise 'duplicated prior template' unless (vs.map{|v|v['template']}&prior['additions'].map{|v|v['template']}).empty?
def selected(vs,record,state,captured)
 matching=vs.select do |v|
  next false unless v['template']==record['template']
  if v['axis']=='historical_age'
   ctx=HistoricalAgeProposal.read(record,state);a=ctx['subjectAgeAtRecord']
   next ctx['status']=='known' && a>=v['min'] && a<=v['max']
  end
  c=captured
  next false unless c.is_a?(Hash)&&c['version']==1&&c['recordId']==record['id']&&c['capturedAtTick'].is_a?(Integer)&&c['capturedAtTick']==record['tick']&&c['source']=='emitter_before_after'
  val=c[v['field']]
  case record['template']
  when 'person.emptied'
   next false unless val.is_a?(Integer)&&val>0&&c['residentsAfter'].is_a?(Integer)&&c['residentsAfter']==0&&c['householdId'].is_a?(String)&&!c['householdId'].empty?&&c['abandonedAfter']==false&&c['burnTransition']==false
  when 'person.bailiff'
   next false unless c['roleAtAppointment']=='head'&&c['householdId']!='manor'&&c['householdId'].is_a?(String)&&!c['householdId'].empty?&&c['ageAtAppointment'].is_a?(Integer)&&(25..60).include?(c['ageAtAppointment'])
  when 'person.steward'
   next false unless c['predecessorCountBefore'].is_a?(Integer)&&c['predecessorCountBefore']==1&&c['predecessorId'].is_a?(String)&&!c['predecessorId'].empty?&&c['predecessorRoleBefore']=='steward'&&c['predecessorPresentBefore']==true&&c['predecessorAbsentAfter']==true&&c['predecessorMovedToPastThisTick']==true
   next false unless (val=='died'&&c['predecessorAliveAfter']==false)||(val=='left_town'&&c['predecessorAliveAfter']==true)
  end
  v['op']=='eq' ? val==v['value'] : val>=v['value']
 end
 raise 'overlap' if matching.size>1
 matching.first
end
results=[]
run=lambda do |id,template,state,capture,expect|
 r={'id'=>'fixture-record','tick'=>4000,'template'=>template,'subject'=>{'type'=>'person','id'=>'fixture-person'}}
 frozen=JSON.generate([r,state,capture]);v=selected(vs,r,state,capture)
 raise "fixture #{id}: #{v && v['id']} != #{expect}" unless (v && v['id'])==expect
 raise 'input mutation' unless frozen==JSON.generate([r,state,capture])
 text=v && v['headline'];text=text.gsub('{ageAtRecord}',HistoricalAgeProposal.read(r,state)['subjectAgeAtRecord'].to_s) if text && text.include?('{ageAtRecord}')
 results<<{id:id,template:template,selected:v && v['id'],headline:text,inputSnapshot:state,capturedProposal:capture,fallback:v.nil?,installable:false}
end
state=lambda{|age|{'scenarioId'=>'core:campaign_market_town','tick'=>4000,'persons'=>{'people'=>[{'id'=>'fixture-person','birthYear'=>1301-age}],'past'=>[]}}}
{
'person.arrived'=>{13=>nil,14=>'young',29=>'young',30=>nil,54=>nil,55=>'elder',70=>'elder',71=>nil},
'person.reeve'=>{24=>nil,25=>'youth',29=>'youth',30=>'adult',54=>'adult',55=>'elder',60=>'elder',61=>nil},
'person.expecting'=>{15=>nil,16=>'youth',29=>'youth',30=>'adult',44=>'adult',45=>nil}
}.each{|t,cases|cases.each{|a,e|run.call("#{t}_#{a}",t,state.call(a),nil,e && "#{t}.r06ctx.#{e}")};bad=state.call(30);bad['scenarioId']='unknown';run.call(t+'_unknown_scenario',t,bad,nil,nil);bad=state.call(30);bad['persons']['people']*=2;run.call(t+'_duplicate_person',t,bad,nil,nil)}
common={'version'=>1,'recordId'=>'fixture-record','capturedAtTick'=>4000,'source'=>'emitter_before_after'}
cases=[
 ['person.emptied','one',{'residentsBefore'=>1,'residentsAfter'=>0,'householdId'=>'house-test','abandonedAfter'=>false,'burnTransition'=>false}],
 ['person.emptied','many',{'residentsBefore'=>3,'residentsAfter'=>0,'householdId'=>'house-test','abandonedAfter'=>false,'burnTransition'=>false}],
 ['person.bailiff','artisan',{'classBandAtAppointment'=>'artisan','roleAtAppointment'=>'head','householdId'=>'house-test','ageAtAppointment'=>35}],
 ['person.bailiff','merchant',{'classBandAtAppointment'=>'merchant','roleAtAppointment'=>'head','householdId'=>'house-test','ageAtAppointment'=>35}],
 ['person.steward','after_death',{'predecessorExitAtAppointment'=>'died','predecessorId'=>'predecessor-test','predecessorCountBefore'=>1,'predecessorRoleBefore'=>'steward','predecessorPresentBefore'=>true,'predecessorAbsentAfter'=>true,'predecessorMovedToPastThisTick'=>true,'predecessorAliveAfter'=>false}],
 ['person.steward','after_departure',{'predecessorExitAtAppointment'=>'left_town','predecessorId'=>'predecessor-test','predecessorCountBefore'=>1,'predecessorRoleBefore'=>'steward','predecessorPresentBefore'=>true,'predecessorAbsentAfter'=>true,'predecessorMovedToPastThisTick'=>true,'predecessorAliveAfter'=>true}]
]
cases.each do |t,id,c|
 snapshot=common.merge(c);run.call(id,t,{},snapshot,"#{t}.r06ctx.#{id}")
 run.call(id+'_missing',t,{},nil,nil)
 run.call(id+'_tick_string',t,{},snapshot.merge('capturedAtTick'=>'4000'),nil)
 run.call(id+'_tick_float',t,{},snapshot.merge('capturedAtTick'=>4000.0),nil)
 run.call(id+'_wrong_tick',t,{},snapshot.merge('capturedAtTick'=>3999),nil)
 run.call(id+'_current_state',t,{},snapshot.merge('source'=>'current_state'),nil)
 snapshot.select{|_,value|value.is_a?(Integer)}.each{|k,value|run.call(id+'_numeric_string_'+k,t,{},snapshot.merge(k=>value.to_s),nil)}
 snapshot.each_key{|k|bad=snapshot.reject{|a,_|a==k};run.call(id+'_missing_'+k,t,{},bad,nil)}
end
sources=JSON.parse(File.read(ROOT+'/SOURCE_EVIDENCE.json'));repo='/Users/rexxa/fls-astra-steward'
sources.each{|s|txt=File.read(repo+'/'+s['path']);raise 'source drift' unless Digest::SHA256.hexdigest(txt)==s['sha256'];s['spans'].each{|r|raise 'span' unless txt.lines[(r['start']-1)..(r['end']-1)].join==r['text']}}
JSON.parse(File.read(ROOT+'/INHERITED_EVIDENCE.json')).each{|i|raise 'prior modified' unless Digest::SHA256.file(i['path']).hexdigest==i['sha256']}
raise 'canonical changed' unless Digest::SHA256.file(base).hexdigest==pkg['baselineSha256']
File.write(ROOT+'/FIXTURE_RESULTS.json',JSON.pretty_generate(results)+"\n")
report={status:'PASS_OFFLINE_PROPOSAL_ONLY',mappedTypes:12,existingAgeVariantsReused:20,newProposalTypes:6,newCandidates:13,fixtures:results.size,sourceFiles:sources.size,canonicalModified:false,sourceRecordsModified:false,runtimeVerified:false,naturalOccurrenceVerified:false,independentReview:'pending',newSnapshotFieldsImplemented:false,canonicalSchemaCompatible:false,allTypesComplete:false}
File.write(ROOT+'/VALIDATION.json',JSON.pretty_generate(report)+"\n");puts JSON.pretty_generate(report)
