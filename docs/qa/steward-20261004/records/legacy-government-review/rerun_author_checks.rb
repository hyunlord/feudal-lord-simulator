require '/tmp/astra-steward-r06-20261004/records/legacy-government-context/schema_validator'
r='/tmp/astra-steward-r06-20261004/records/legacy-government-context';read=lambda{|f|JSON.parse(File.read(r+'/'+f))};p=read.call('PROPOSAL.json');ps=read.call('PROPOSAL.schema.json');cs=read.call('CONTEXT.schema.json');rs=read.call('RECORD.schema.json');fs=read.call('FIXTURES.json');validate_schema(p,ps,ps)
canonical=File.dirname(File.dirname(r))+'/chronicle/variants.ko.json';before=Digest::SHA256.file(canonical).hexdigest
raise 'baseline SHA changed before check' unless before==p['baselineSha256']
selector=lambda do |record,c|
 begin
 validate_schema(record,rs,rs);validate_schema(c,cs,cs)
 rescue RuntimeError
 next nil
 end
 next nil unless c['status']=='known'&&c['recordId']==record['id']&&c['recordTick']==record['tick']&&c['template']==record['template']
 t=p['templates'].find{|x|x['template']==record['template']};vs=t['variants'].select{|v|v['when']['value']==c['fields'][t['field']]};raise 'overlap' if vs.size>1;vs.first && vs.first['id']
end
results=[]
fs.each do |f|
 raise 'positive' unless selector.call(f['record'],f['context'])==f['expected']
 results<<{id:f['id'],expected:f['expected'],selected:f['expected'],positive:true}
 %w[empty missing_field domain wrong_template unverified wrong_capture negative_tick wrong_head extra_field bad_tick empty_id wrong_id wrong_tick unknown].each do |kind|
 c=Marshal.load(Marshal.dump(f['context']))
 case kind
 when 'empty';c['fields']={}
 when 'missing_field';c.delete('fields')
 when 'domain';c['fields']=c['fields'].transform_values{'invented'}
 when 'wrong_template';c['template']=f['record']['template']=='legacy.city_seal' ? 'legacy.charter_sealed' : 'legacy.city_seal'
 when 'unverified';c['referenceVerified']=false
 when 'wrong_capture';c['captureKind']='current_state'
 when 'negative_tick';c['recordTick']=-1
 when 'wrong_head';c['sourceHead']='unknown'
 when 'extra_field';c['fields']['invented']='invented'
 when 'bad_tick';c['recordTick']='440000'
 when 'empty_id';c['recordId']=''
 when 'wrong_id';c['recordId']='another-record'
 when 'wrong_tick';c['recordTick']=440001
 when 'unknown';c['status']='unknown';c['referenceVerified']=false;c['fields']={}
 end
 raise 'context fallback' unless selector.call(f['record'],c).nil?
 results<<{id:f['id']+'.'+kind,selected:nil,context:c}
 end
 %w[empty_id blank_id multiline_id float_tick wrong_template extra_field missing_tick].each do |kind|
 q=Marshal.load(Marshal.dump(f['record']))
 case kind
 when 'empty_id';q['id']=''
 when 'blank_id';q['id']=' '
 when 'multiline_id';q['id']="valid\ninvalid"
 when 'float_tick';q['tick']=440000.0
 when 'wrong_template';q['template']='legacy.unknown'
 when 'extra_field';q['override']='accept'
 when 'missing_tick';q.delete('tick')
 end
 raise 'record gate' unless selector.call(q,f['context']).nil?
 results<<{id:f['id']+'.record_'+kind,selected:nil,record:q}
 end
end
%w[headline missing_fact context_rule missing_template].each do |kind|
 q=Marshal.load(Marshal.dump(p))
 case kind
 when 'headline';q['templates'][0]['variants'][0]['headline']='변경'
 when 'missing_fact';q['templates'][0]['variants'][0].delete('retainFactLine')
 when 'context_rule';q['templates'][0]['variants'][0]['when']['value']='invented'
 when 'missing_template';q['templates'].pop
 end
 rejected=false;begin;validate_schema(q,ps,ps);rescue RuntimeError;rejected=true;end;raise 'proposal freeze' unless rejected
end
sources=read.call('SOURCE_EVIDENCE.json');sources.each{|x|txt=File.read('/Users/rexxa/fls-astra-steward/'+x['path']);raise 'sourceSHA' unless Digest::SHA256.hexdigest(txt)==x['sha256'];x['spans'].each{|s|raise 'span' unless txt.lines[(s['start']-1)..(s['end']-1)].join==s['text']}}
vs=p['templates'].flat_map{|t|t['variants']};raise 'unique/14/facts' unless vs.size==14&&vs.map{|v|v['id']}.uniq.size==14&&vs.all?{|v|v['retainFactLine']==true&&v['requiredSlots']==[]&&!v['headline'].match?(/[{}]/)}
raise 'canonical modified' unless Digest::SHA256.file(canonical).hexdigest==before
File.write('/tmp/astra-steward-r06-20261004/records/legacy-government-review'+'/FIXTURE_RESULTS.json',JSON.pretty_generate(results)+"\n")
report={status:'AUTHOR_DRAFT_COMPLETE_INTEGRATION_BLOCKED',templates:6,variants:14,positiveFixtures:14,negativeContextFixtures:196,negativeRecordFixtures:98,proposalNegativeFixtures:4,totalSelectorFixtures:results.size,strictSchemaBeforeSelector:true,sourceFiles:sources.size,sourceSpans:sources.sum{|s|s['spans'].size},canonicalModified:false,actualCaptureImplemented:false,runtimeExecuted:false,naturalOccurrenceVerified:false,independentReview:'pending',immutableProvenanceVerified:false}
File.write('/tmp/astra-steward-r06-20261004/records/legacy-government-review'+'/VALIDATION.json',JSON.pretty_generate(report)+"\n");puts JSON.pretty_generate(report)
