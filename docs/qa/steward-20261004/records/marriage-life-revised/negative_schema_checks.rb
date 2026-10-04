def negative_schema_checks(p,s,c,fixtures)
 cases=[]
 mutate=lambda{|id,base,schema,&block|v=Marshal.load(Marshal.dump(base));block.call(v);cases<<[id,v,schema]}
 mutate.call('proposal.fields.empty',p,s){|v|v['fields']=[]}
 mutate.call('proposal.fallback.empty',p,s){|v|v['fallback']={}}
 mutate.call('proposal.field.domain',p,s){|v|v['fields'][0]['values']<<'invented'}
 mutate.call('proposal.when.empty',p,s){|v|v['additions'][0]['variant']['when']=[]}
 mutate.call('proposal.condition.domain',p,s){|v|v['additions'][0]['variant']['when'][0]['value']='invented'}
 mutate.call('proposal.condition.wrong_template',p,s){|v|v['additions'][0]['template']='negotiation.accepted'}
 mutate.call('proposal.condition.op_type',p,s){|v|v['additions'][0]['variant']['when'][0]['op']='in'}
 mutate.call('proposal.condition.in_empty',p,s){|v|v['additions'][0]['variant']['when'][0].merge!('op'=>'in','value'=>[])}
 mutate.call('proposal.fact_line.missing',p,s){|v|v['additions'][0]['variant'].delete('retainFactLine')}
 mutate.call('proposal.slot.unapproved',p,s){|v|v['additions'][0]['variant']['requiredSlots']=['currentName']}
 fixtures.select{|f|f['expected']}.group_by{|f|f['template']}.each do |t,fs|
  b=fs.first['context']
  mutate.call(t+'.known_empty',b,c){|v|v['fields']={}}
  mutate.call(t+'.known_missing_field',b,c){|v|v.delete('fields')}
  mutate.call(t+'.domain',b,c){|v|v['fields']=v['fields'].transform_values{'invented'}}
  mutate.call(t+'.wrong_template',b,c){|v|v['template']=t=='marriage.lost' ? 'marriage.father_ill' : 'marriage.lost'}
  mutate.call(t+'.provenance',b,c){|v|v['captureKind']=v['captureKind']=='emission_snapshot' ? 'immutable_contract_reference' : 'emission_snapshot'}
  mutate.call(t+'.unverified',b,c){|v|v['referenceVerified']=false}
mutate.call(t+'.negative_tick',b,c){|v|v['recordTick']=-1}
mutate.call(t+'.unsafe_tick',b,c){|v|v['recordTick']=9007199254740992}
mutate.call(t+'.fractional_tick',b,c){|v|v['recordTick']=1000.5}
mutate.call(t+'.missing_template',b,c){|v|v.delete('template')}
mutate.call(t+'.empty_sourceHead',b,c){|v|v['sourceHead']=''}
mutate.call(t+'.other_sourceHead',b,c){|v|v['sourceHead']='0'*40}

  mutate.call(t+'.unknown_with_facts',b,c){|v|v['status']='unknown'}
 end
 results=cases.map do |id,value,schema|
  accepted=true;begin;validate_schema(value,schema,schema);rescue RuntimeError;accepted=false;end
  raise "schema incorrectly accepted #{id}" if accepted
  {id:id,rejected:true}
 end
 known=fixtures.select{|f|f['expected']};known.each{|f|validate_schema(f['context'],c,c)}
 unknown=Marshal.load(Marshal.dump(known.first['context']));unknown['status']='unknown';unknown['fields']={};unknown['referenceVerified']=false;validate_schema(unknown,c,c)
 [0,9007199254740991].each{|tick|boundary=Marshal.load(Marshal.dump(known.first['context']));boundary['recordTick']=tick;validate_schema(boundary,c,c)}
 {safeTickBoundaryPositiveCases:2,status:'PASS_SUPPORTED_SCHEMA_SUBSET',negativeCases:results,negativeCount:results.size,knownPositiveCount:known.size,unknownEmptyAccepted:true,scope:'JSON schema keywords used in these documents executed by explicit Ruby subset validator; not full JSON Schema conformance suite or provenance proof'}
end
