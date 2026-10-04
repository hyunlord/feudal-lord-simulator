require 'json';require 'digest'
r='/tmp/astra-steward-r06-20261004/records/fixed-context-revised';old='/tmp/astra-steward-r06-20261004/records/fixed-context-second-pass'
require r+'/parent_capture'
a=JSON.parse(File.read(r+'/PROPOSAL.json'));b=JSON.parse(File.read(old+'/PROPOSAL.json'))
raise 'variant drift' unless a['additions']==b['additions']
raise 'holds drift' unless File.read(r+'/ADOPTION_LIMITS.json')==File.read(old+'/ADOPTION_LIMITS.json')
child={'id'=>'c','alive'=>true,'householdId'=>'h','motherId'=>'m','fatherId'=>'f'};m={'id'=>'m','alive'=>true,'householdId'=>'h'};f={'id'=>'f','alive'=>false,'householdId'=>'h'}
rows=[]
add=lambda{|id,s,pastpeople,past,want|got=parent_context(s,pastpeople,past);raise id unless got==want;rows<<{id:id,actual:got,expected:want}}
add.call('original_migrated_counterexample',child,[child],[m.merge('leftYear'=>1310),f],'not_co_resident')
add.call('current_mother',child,[child,m],[f],'co_resident')
add.call('subject_absent',child,[m],[f],nil)
add.call('subject_duplicate',child,[child,child,m],[f],nil)
add.call('parent_is_subject',child.merge('motherId'=>'c'),[child.merge('motherId'=>'c'),m],[f],nil)
add.call('parent_alive_string',child,[child,m.merge('alive'=>'true')],[f],nil)
add.call('parent_empty_home',child,[child,m.merge('householdId'=>'')],[f],nil)
add.call('parent_duplicate_people',child,[child,m,m],[f],nil)
add.call('nonarray_people',child,nil,[m,f],nil)
add.call('nonarray_past',child,[child,m],nil,nil)
add.call('nonsubject',nil,[child,m],[f],nil)
add.call('missing_subject_alive',child.reject{|k,_|k=='alive'},[child.reject{|k,_|k=='alive'},m],[f],nil)
File.write(__dir__+'/PARENT_INDEPENDENT.json',JSON.pretty_generate({cases:rows,variantObjectsPreserved:10,compositionHoldsByteIdentical:true,engineExecuted:false})+"\n")
