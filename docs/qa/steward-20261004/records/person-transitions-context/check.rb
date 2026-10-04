require 'json'
require 'digest'
require_relative 'schema_validator'
require_relative 'capture'
root=__dir__
read=->(f){JSON.parse(File.read(root+'/'+f))}
write=->(f,d){File.write(root+'/'+f,JSON.pretty_generate(d)+"\n")}
p=read.call('PROPOSAL.json'); cs=read.call('CONTEXT.schema.json'); ps=read.call('PROPOSAL.schema.json')
validate_schema(p,ps,ps)
clone=->(x){Marshal.load(Marshal.dump(x))}
person=->(id,house,role='head',alive=true){{'id'=>id,'householdId'=>house,'role'=>role,'alive'=>alive}}
house=->(count){{'id'=>'h1','residents'=>count,'burnt'=>false,'abandoned'=>false}}
snapshot=->(tick,houses,people,past=[]){{'tick'=>tick,'houses'=>houses,'people'=>people,'past'=>past}}
record=->(template,id,type='person',hh='h1'){{'id'=>'record-1','tick'=>1000,'template'=>template,'subject'=>{'type'=>type,'id'=>id},'actors'=>type=='household'||hh=='manor' ? [] : [{'type'=>'household','id'=>hh}]}}
fixtures=[]
add=->(id,r,b,a,expected){fixtures<<{'id'=>id,'record'=>r,'before'=>b,'after'=>a,'expected'=>expected}}
[1,3].each do |n|
 b=snapshot.call(999,[house.call(0)],[]); a=snapshot.call(1000,[house.call(n)],[person.call('p1','h1')]); r=record.call('person.move_in','p1')
 add.call('move_in.'+n.to_s,r,b,a,'person.move_in.r06transition.'+(n==1 ? 'one' : 'several'))
end
%w[manor h1].each do |hh|
 b=snapshot.call(999,hh=='manor' ? [] : [house.call(1)],[person.call('p1',hh)]); a=snapshot.call(1000,hh=='manor' ? [] : [house.call(2)],[person.call('p1',hh),person.call('p2',hh,'spouse')]); r=record.call('person.married','p2','person',hh)
 add.call('married.'+hh,r,b,a,'person.married.r06transition.'+(hh=='manor' ? 'manor' : 'town_house'))
end
[true,false].each do |remain|
 b=snapshot.call(999,[house.call(remain ? 2 : 1)],[person.call('p1','h1')]+(remain ? [person.call('p2','h1','kin')] : [])); a=snapshot.call(1000,[house.call(remain ? 1 : 0)],remain ? [person.call('p2','h1','head')] : [],[person.call('p1','h1')]);r=record.call('person.left_town','p1')
 add.call('left.'+remain.to_s,r,b,a,'person.left_town.r06transition.'+(remain ? 'present' : 'absent'))
end
positive=clone.call(fixtures)
positive.each do |base|
 mutations={
  'empty_record_id'=>->(f){f['record']['id']=''},
  'wrong_tick'=>->(f){f['record']['tick']=1001},
  'no_before_time'=>->(f){f['before']['tick']=1000},
  'empty_subject'=>->(f){f['record']['subject']['id']=''},
  'wrong_subject'=>->(f){f['record']['subject']['id']='wrong'},
  'missing_snapshot'=>->(f){f['before'].delete('people')},
  'wrong_house_actor'=>->(f){f['record']['actors']=[{'type'=>'household','id'=>'wrong'}]},
  'duplicate_people'=>->(f){f['before']['people']=[person.call('dup','h1'),person.call('dup','h1')]},
  'unknown_field'=>->(f){f['after']['currentMood']='invented'},
  'unsafe_tick'=>->(f){f['after']['tick']=9007199254740992;f['record']['tick']=9007199254740992},
  'dead_in_living'=>->(f){f['after']['people']<<person.call('dead','h1','kin',false)}
 }
 mutations.each{|name,fn|f=clone.call(base);fn.call(f);f['id']+='.'+name;f['expected']=nil;fixtures<<f}
end
custom=->(base,name,expected,&fn){f=clone.call(base);fn.call(f);f['id']+='.'+name;f['expected']=expected;fixtures<<f}
custom.call(positive[0],'household_subject',positive[0]['expected']){|f|f['after']['people']=[];f['record']=record.call('person.move_in','h1','household')}
custom.call(positive[0],'contradictory_household_subject',nil){|f|f['record']=record.call('person.move_in','h1','household')}
custom.call(positive[0],'was_occupied',nil){|f|f['before']['houses'][0]['residents']=1}
custom.call(positive[0],'new_burn',nil){|f|f['after']['houses'][0]['burnt']=true}
custom.call(positive[0],'new_abandon',nil){|f|f['after']['houses'][0]['abandoned']=true}
custom.call(positive[0],'old_abandon',nil){|f|f['before']['houses'][0]['abandoned']=true}
custom.call(positive[0],'no_increase',nil){|f|f['after']['houses'][0]['residents']=0}
custom.call(positive[0],'fractional_residents',nil){|f|f['after']['houses'][0]['residents']=1.5}
custom.call(positive[0],'subject_not_head',nil){|f|f['after']['people'][0]['role']='child'}
custom.call(positive[2],'existing_spouse_subject',nil){|f|f['before']['people']<<person.call('p2','manor','spouse')}
custom.call(positive[2],'new_person_not_spouse',nil){|f|f['after']['people'][1]['role']='kin'}
custom.call(positive[2],'different_head',nil){|f|f['after']['people'][0]['id']='another'}
custom.call(positive[2],'no_old_head',nil){|f|f['before']['people']=[]}
custom.call(positive[3],'unknown_house',nil){|f|f['after']['houses']=[]}
custom.call(positive[3],'abandoned_house',nil){|f|f['after']['houses'][0]['abandoned']=true}
custom.call(positive[4],'died_not_left',nil){|f|f['after']['past'][0]['alive']=false}
custom.call(positive[4],'still_in_people',nil){|f|f['after']['people']<<person.call('p1','h1')}
custom.call(positive[4],'household_reassigned',nil){|f|f['after']['past'][0]['householdId']='other'}
custom.call(positive[4],'missing_past_entry',nil){|f|f['after']['past']=[]}
custom.call(positive[4],'changed_past_prefix',nil){|f|f['before']['past']=[person.call('prior','h1','kin',false)];f['after']['past'].unshift(person.call('other','h1','kin',false))}
results=fixtures.map do |f|
 context=TransitionDraft.capture(f['record'],f['before'],f['after']);actual=TransitionDraft.select(p,f['record'],context,cs)
 raise "capture #{f['id']} expected #{f['expected']} got #{actual}" unless actual==f['expected']
 {'id'=>f['id'],'selected'=>actual,'context'=>context}
end
negative=[]
positive.each do |f|
 c=TransitionDraft.capture(f['record'],f['before'],f['after'])
 {'empty_fields'=>->(x){x['fields']={}},'invented_domain'=>->(x){x['fields']=x['fields'].transform_values{'made_up'}},'extra_field'=>->(x){x['fields']['motive']='poor'},'extra_envelope'=>->(x){x['names']='frozen'},'missing_id'=>->(x){x.delete('recordId')},'empty_id'=>->(x){x['recordId']=''},'negative_tick'=>->(x){x['recordTick']=-1},'fractional_tick'=>->(x){x['recordTick']=0.5},'unsafe_tick'=>->(x){x['recordTick']=9007199254740992},'wrong_source'=>->(x){x['sourceHead']='0'*40},'wrong_capture'=>->(x){x['captureKind']='read_time_lookup'},'wrong_template'=>->(x){x['template']=x['template']=='person.married' ? 'person.move_in' : 'person.married'}}.each do |name,fn|
  v=clone.call(c);fn.call(v);rejected=false;begin;validate_schema(v,cs,cs);rescue RuntimeError;rejected=true;end
  raise "negative #{name}" unless rejected&&TransitionDraft.select(p,f['record'],v,cs).nil?
  negative<<{'id'=>f['id']+'.'+name,'schemaRejected'=>true,'selectorFallback'=>true}
 end
 %w[recordId recordTick householdId].each do |key|
  v=clone.call(c);v[key]=key=='recordTick' ? 1001 : 'other';validate_schema(v,cs,cs)
  raise 'record binding' unless TransitionDraft.select(p,f['record'],v,cs).nil?
  negative<<{'id'=>f['id']+'.binding_'+key,'schemaRejected'=>false,'selectorFallback'=>true}
 end
 unknown={'status'=>'unknown','recordId'=>f['record']['id'],'recordTick'=>1000,'template'=>f['record']['template'],'subject'=>f['record']['subject'],'fields'=>{}}
 validate_schema(unknown,cs,cs);raise 'unknown selected' unless TransitionDraft.select(p,f['record'],unknown,cs).nil?
end
proposal_negative=[]
{'empty_contracts'=>->(x){x['fields']=[]},'empty_fallback'=>->(x){x['fallback']={}},'empty_when'=>->(x){x['additions'][0]['variant']['when']=[]},'wrong_template_field'=>->(x){x['additions'][0]['template']='person.married'},'invented_condition'=>->(x){x['additions'][0]['variant']['when'][0]['value']='invented'}}.each do |name,fn|
 v=clone.call(p);fn.call(v);rejected=false;begin;validate_schema(v,ps,ps);rescue RuntimeError;rejected=true;end;raise name unless rejected;proposal_negative<<name
end
sources=read.call('SOURCE_EVIDENCE.json');sources.each{|s|text=File.read('/Users/rexxa/fls-astra-steward/'+s['path']);raise 'source SHA drift' unless Digest::SHA256.hexdigest(text)==s['sha256'];s['spans'].each{|sp|raise 'source range drift' unless text.lines[(sp['start']-1)..(sp['end']-1)].join==sp['text']}}
canonical=File.dirname(File.dirname(root))+'/chronicle/variants.ko.json';raise 'canonical drift' unless Digest::SHA256.file(canonical).hexdigest==p['baselineSha256']
ids=p['additions'].map{|x|x['variant']['id']};raise 'duplicate' unless ids.uniq.size==6
base=JSON.parse(File.read(canonical));existing=(base['historyTemplates']+base['ledgerCategories']).flat_map{|g|g['variants'].map{|v|v['id']}};raise 'collision' unless (existing&ids).empty?
write.call('FIXTURES.json',fixtures);write.call('FIXTURE_RESULTS.json',results);write.call('SCHEMA_RESULTS.json',{'contexts'=>negative,'proposalRejected'=>proposal_negative})
write.call('VALIDATION.json',{'status'=>'AUTHOR_OFFLINE_CHECKS_PASS_PENDING_INDEPENDENT_REVIEW','templates'=>3,'candidates'=>6,'captureSelectionFixtures'=>fixtures.size,'positiveCaptureCases'=>fixtures.count{|f|f['expected']},'schemaNegative'=>negative.count{|x|x['schemaRejected']},'selectorBindingCases'=>negative.count{|x|!x['schemaRejected']},'proposalNegative'=>proposal_negative.size,'unknownFallbackCases'=>positive.size,'sourceFiles'=>sources.size,'sourceSpans'=>sources.sum{|s|s['spans'].size},'canonicalSha256'=>p['baselineSha256'],'sourceHead'=>p['sourceHead'],'runtimeExecuted'=>false,'actualCaptureAdapterImplemented'=>false,'canonicalModified'=>false,'independentReview'=>'pending'})
puts File.read(root+'/VALIDATION.json')
